import { getServiceSupabase } from '@/lib/supabase';
import { sendRealtimeNotificationEmail } from '@/lib/email/nodemailer';
import { isSmtpConfigured } from '@/lib/email/smtp-config';
import { toAbsoluteNotificationUrl } from '@/lib/notifications/digest';
import { normalizeEmailFrequencyByChannel } from '@/lib/notifications/preferences';
import { canUseRealtimeAlerts } from '@/lib/stemme-plus/gates';
import { getUserSubscription } from '@/lib/stemme-plus/service';
import { isStemmePlusActive } from '@/lib/stemme-plus/tier';
import {
  NOTIFICATION_PREFERENCE_COLUMNS,
  isMissingColumnError,
  normalizeNotificationPreferences,
  readCaseInfo,
  shouldSendNotification,
} from '@/lib/notifications/filters';
import type {
  AdminComposeNotificationInput,
  CreateNotificationInput,
  CreateNotificationResult,
} from '@/lib/notifications/types';

export type {
  AdminComposeNotificationInput,
  CreateNotificationInput,
  CreateNotificationResult,
} from '@/lib/notifications/types';
export type { NotificationChannel, NotificationFrequency } from '@/lib/notifications/channels';
export {
  CHANNEL_UI_COPY,
  DEFAULT_EMAIL_FREQUENCY_BY_CHANNEL,
  NOTIFICATION_CHANNELS,
} from '@/lib/notifications/channels';
export { normalizeEmailFrequencyByChannel, pickDigestChannels } from '@/lib/notifications/preferences';

async function ensurePreferences(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const service = getServiceSupabase();
  const { error } = await service.from('notification_preferences').upsert(
    { user_id: userId },
    { onConflict: 'user_id', ignoreDuplicates: true },
  );

  if (error) {
    console.error('Failed to ensure notification preferences', error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

async function getPreferences(userId: string) {
  const ensured = await ensurePreferences(userId);
  if (!ensured.ok) {
    return { ok: false as const, error: ensured.error };
  }

  const service = getServiceSupabase();
  let hasV2 = true;
  let { data, error } = await service
    .from('notification_preferences')
    .select(`email_enabled,email_frequency_by_channel,${NOTIFICATION_PREFERENCE_COLUMNS}`)
    .eq('user_id', userId)
    .maybeSingle();

  if (error && isMissingColumnError(error)) {
    // Migration 20261014160000_notification_preferences_v2 not applied yet: fall back to legacy columns.
    hasV2 = false;
    ({ data, error } = await service
      .from('notification_preferences')
      .select('email_enabled,email_frequency_by_channel')
      .eq('user_id', userId)
      .maybeSingle());
  }

  if (error) {
    console.error('Failed to load notification preferences', error);
    return { ok: false as const, error: error.message };
  }

  const row = (data ?? null) as Record<string, unknown> | null;
  const emailEnabled = (row?.email_enabled as boolean | null | undefined) ?? true;
  const freq = normalizeEmailFrequencyByChannel(
    (row?.email_frequency_by_channel || {}) as Record<string, unknown>,
  );

  return { ok: true as const, emailEnabled, freq, hasV2, row: hasV2 ? row : null };
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<CreateNotificationResult> {
  const prefs = await getPreferences(input.userId);
  if (!prefs.ok) {
    return { ok: false, error: prefs.error };
  }

  // Server-side enforcement: tier is re-read at send time so a downgraded user
  // never keeps Stemme+ behaviour (email, realtime, relaxed old-case rule).
  const subscription = await getUserSubscription(input.userId);
  const isPlus = isStemmePlusActive(subscription);
  const v2 = normalizeNotificationPreferences(prefs.row, isPlus);

  if (!shouldSendNotification(v2, isPlus, input.type, readCaseInfo(input.data))) {
    return { ok: true, id: 'filtered', emailSent: false, emailSkippedReason: 'filtered' };
  }

  const service = getServiceSupabase();
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
    return { ok: false, error: error.message };
  }

  // E-mail is Stemme+ only: free users never get e-mail (their weekly digest is in-app).
  if (!isPlus) {
    return { ok: true, id: inserted.id, emailSent: false, emailSkippedReason: 'disabled' };
  }

  const preference = prefs.hasV2 ? v2.frequency : (prefs.freq[input.channel] ?? 'daily');
  const emailChannelOn = prefs.hasV2 ? v2.channel_email : true;
  if (!prefs.emailEnabled || !emailChannelOn || preference !== 'realtime') {
    return {
      ok: true,
      id: inserted.id,
      emailSent: false,
      emailSkippedReason: !prefs.emailEnabled || !emailChannelOn ? 'disabled' : 'not_realtime',
    };
  }

  if (!canUseRealtimeAlerts(subscription)) {
    return {
      ok: true,
      id: inserted.id,
      emailSent: false,
      emailSkippedReason: 'not_realtime',
    };
  }

  if (!isSmtpConfigured()) {
    console.warn('Realtime notification email skipped: SMTP is not configured', {
      userId: input.userId,
      notificationId: inserted.id,
    });
    return {
      ok: true,
      id: inserted.id,
      emailSent: false,
      emailSkippedReason: 'smtp_not_configured',
    };
  }

  try {
    const userRes = await service.auth.admin.getUserById(input.userId);
    const email = userRes.data.user?.email;
    if (!email) {
      return {
        ok: true,
        id: inserted.id,
        emailSent: false,
        emailSkippedReason: 'no_email',
      };
    }

    const absoluteUrl = toAbsoluteNotificationUrl(input.url, input.origin || '');

    await sendRealtimeNotificationEmail({
      to: email,
      subject: input.title,
      title: input.title,
      body: input.body,
      url: absoluteUrl ?? null,
    });

    await service
      .from('notifications')
      .update({ emailed_at: new Date().toISOString(), email_last_error: null })
      .eq('id', inserted.id);

    return { ok: true, id: inserted.id, emailSent: true };
  } catch (e) {
    console.error('Failed to send realtime notification email', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    await service.from('notifications').update({ email_last_error: message }).eq('id', inserted.id);
    return { ok: true, id: inserted.id, emailSent: false };
  }
}

/**
 * Service-role entry point for future admin broadcast / smarter alerts.
 * Today it delegates to `createNotification` with optional delivery overrides.
 */
export async function dispatchNotification(
  input: AdminComposeNotificationInput,
): Promise<CreateNotificationResult> {
  const delivery = input.delivery ?? 'both';

  if (delivery === 'email_only') {
    // E-mail is Stemme+ only — enforced for every server-side send path.
    if (!isStemmePlusActive(await getUserSubscription(input.userId))) {
      return { ok: false, error: 'E-post er kun for Stemme+' };
    }
    if (!isSmtpConfigured()) {
      return { ok: false, error: 'SMTP is not configured' };
    }

    const service = getServiceSupabase();
    const userRes = await service.auth.admin.getUserById(input.userId);
    const email = userRes.data.user?.email;
    if (!email) {
      return { ok: false, error: 'User has no email address' };
    }

    const absoluteUrl = toAbsoluteNotificationUrl(input.url, input.origin || '');
    await sendRealtimeNotificationEmail({
      to: email,
      subject: input.title,
      title: input.title,
      body: input.body,
      url: absoluteUrl ?? null,
    });

    return { ok: true, id: 'email-only', emailSent: true };
  }

  const result = await createNotification(input);
  if (!result.ok || delivery === 'in_app_only') {
    return result;
  }

  return result;
}
