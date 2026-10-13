import { getUserStanceSignals } from '@/lib/stances/service';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * Personal-context helpers for the chat assistant.
 *
 * SECURITY: every function here takes `userId` from the request session
 * (`gate.userId`) and never from client input or model-controlled tool
 * arguments. The underlying stance/profile RPCs are `SECURITY DEFINER` and
 * accept a `p_user_id` parameter, so granting them to `authenticated` would
 * let any user read another user's data. Keep these on the service role and
 * keep the id server-derived.
 */

export type ChatStanceSignals = {
  categories: { value: string; count: number }[];
  labels: { value: string; count: number }[];
};

/**
 * What the viewer tends to agree with. `service` is the caller's session client
 * when available; the stance RPC still requires the service role.
 */
export async function getChatViewerSignals(
  userId: string,
  client?: SupabaseClient | null,
): Promise<ChatStanceSignals> {
  if (!userId) return { categories: [], labels: [] };
  try {
    const service = (client as unknown as SupabaseClient | undefined) ?? getServiceSupabase();
    return await getUserStanceSignals(service, userId);
  } catch {
    return { categories: [], labels: [] };
  }
}

export type ChatNotificationItem = {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  channel: string;
  createdAt: string;
  read: boolean;
};

/**
 * The viewer's own notification inbox. `notifications` has an
 * `auth.uid() = user_id` SELECT policy, so the request session can read it
 * directly — no service role and no id parameter involved.
 */
export async function listChatNotifications(
  userId: string,
  client: Pick<SupabaseClient, 'from'>,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<ChatNotificationItem[]> {
  if (!userId) return [];
  const limit = Math.min(20, Math.max(1, options.limit ?? 8));
  const fetchLimit = Math.min(100, limit * 2);

  let query = client
    .from('notifications')
    .select('id, title, body, url, channel, created_at, read_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  if (options.unreadOnly) {
    query = query.is('read_at', null);
  }

  const { data, error } = await query;
  if (error) return [];

  const seen = new Set<string>();
  const items: ChatNotificationItem[] = [];
  for (const row of data ?? []) {
    const id = String(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      title: String(row.title),
      body: row.body ? String(row.body) : null,
      url: row.url ? String(row.url) : null,
      channel: String(row.channel),
      createdAt: String(row.created_at),
      read: Boolean(row.read_at),
    });
  }
  return items.slice(0, limit);
}
