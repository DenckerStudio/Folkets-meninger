import { getServiceSupabase } from '@/lib/supabase';
import { sendRealtimeNotificationEmail } from '@/lib/email/nodemailer';

export type NotificationChannel = 'forum' | 'mentions' | 'categories' | 'labels';
export type NotificationFrequency = 'realtime' | 'daily' | 'weekly';

export type CreateNotificationInput = {
  userId: string;
  type: string;
  channel: NotificationChannel;
  title: string;
  body?: string | null;
  url?: string | null;
  data?: Record<string, unknown>;
  origin?: string | null;
};

export function extractMentions(text: string): string[] {
  if (!text) return [];
  const matches = text.matchAll(/(^|\\s)@([\\p{L}0-9_.-]{2,32})\\b/giu);
  const names = new Set<string>();
  for (const m of matches) {
    const name = (m[2] || '').trim();
    if (name) names.add(name);
  }
  return [...names];
}

async function ensurePreferences(userId: string) {
  const service = getServiceSupabase();
  await service.from('notification_preferences').upsert(
    { user_id: userId },
    { onConflict: 'user_id', ignoreDuplicates: true }
  );
}

async function getPreferences(userId: string) {
  await ensurePreferences(userId);
  const service = getServiceSupabase();
  const { data } = await service
    .from('notification_preferences')
    .select('email_enabled,email_frequency_by_channel')
    .eq('user_id', userId)
    .maybeSingle();

  const emailEnabled = data?.email_enabled ?? true;
  const freq = (data?.email_frequency_by_channel || {}) as Record<string, NotificationFrequency>;
  return { emailEnabled, freq };
}

export async function createNotification(input: CreateNotificationInput) {
  const service = getServiceSupabase();
  const { emailEnabled, freq } = await getPreferences(input.userId);

  const { data: inserted, error } = await service
    .from('notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      channel: input.channel,
      title: input.title,
      body: input.body ?? null,
      url: input.url ?? null,
      data: input.data ?? {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to insert notification', error);
    return;
  }

  const preference = freq[input.channel] ?? (input.channel === 'categories' || input.channel === 'labels' ? 'daily' : 'realtime');
  if (!emailEnabled || preference !== 'realtime') return;

  try {
    const userRes = await service.auth.admin.getUserById(input.userId);
    const email = userRes.data.user?.email;
    if (!email) return;

    const absoluteUrl =
      input.url && input.origin && input.url.startsWith('/')
        ? `${input.origin}${input.url}`
        : input.url || undefined;

    await sendRealtimeNotificationEmail({
      to: email,
      subject: input.title,
      title: input.title,
      body: input.body,
      url: absoluteUrl ?? null,
    });

    if (inserted?.id) {
      await service
        .from('notifications')
        .update({ emailed_at: new Date().toISOString(), email_last_error: null })
        .eq('id', inserted.id);
    }
  } catch (e) {
    console.error('Failed to send realtime notification email', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    if (inserted?.id) {
      await service.from('notifications').update({ email_last_error: message }).eq('id', inserted.id);
    }
  }
}

export async function resolveMentionedUserIdsByName(names: string[]): Promise<string[]> {
  const service = getServiceSupabase();
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  // Best-effort: the project already joins `users:author_user_id (name)` in forum queries.
  // Assume a `users` table/view exists with `id` and `name`.
  const { data, error } = await service.from('users').select('id,name').in('name', unique);
  if (error) {
    console.error('Failed to resolve mentions', error);
    return [];
  }
  return (data || []).map((row: any) => row.id).filter(Boolean);
}

