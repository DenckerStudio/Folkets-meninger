import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { sendDigestEmail } from '@/lib/email/nodemailer';
import { isSmtpConfigured } from '@/lib/email/smtp-config';
import { cronAuthResponse, verifyCronAuth } from '@/lib/cron-auth';
import {
  buildDigestCursorUpdate,
  buildInAppDigestSummary,
  resolveDigestSinceIso,
  shouldSendDigestEmail,
  toAbsoluteNotificationUrl,
} from '@/lib/notifications/digest';
import { pickDigestChannels } from '@/lib/notifications/preferences';
import { isDigestFrequency } from '@/lib/notifications/channels';
import { prepareDigestForUser } from '@/lib/notifications/enrichment';
import { getUserSubscription } from '@/lib/stemme-plus/service';
import { isStemmePlusActive } from '@/lib/stemme-plus/tier';
import { NOTIFICATION_CHANNELS } from '@/lib/notifications/channels';
import {
  NOTIFICATION_PREFERENCE_COLUMNS,
  isMissingColumnError,
  normalizeNotificationPreferences,
} from '@/lib/notifications/filters';

export const dynamic = 'force-dynamic';

function parseFrequency(url: URL): 'daily' | 'weekly' {
  const value = url.searchParams.get('frequency');
  if (value && isDigestFrequency(value)) return value;
  return 'daily';
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const frequency = parseFrequency(url);

  // E-mail is Stemme+ only. Free users get the weekly digest as ONE in-app
  // summary notification, so SMTP only gates the Stemme+ e-mail path.
  const smtpConfigured = isSmtpConfigured();
  if (!smtpConfigured) {
    console.warn('Cron digest: SMTP is not configured, only in-app digests for free users will run');
  }

  try {
    const service = getServiceSupabase();

    const legacyColumns = 'user_id,email_enabled,email_frequency_by_channel,last_digest_sent_at_by_channel';
    let hasV2 = true;
    let { data: prefs, error: prefsError } = await service
      .from('notification_preferences')
      .select(`${legacyColumns},${NOTIFICATION_PREFERENCE_COLUMNS}`);
    if (prefsError && isMissingColumnError(prefsError)) {
      // v2 migration not applied yet.
      hasV2 = false;
      ({ data: prefs, error: prefsError } = await service
        .from('notification_preferences')
        .select(legacyColumns));
    }

    if (prefsError) {
      console.error('Cron digest preferences query error', prefsError);
      return NextResponse.json({ error: 'Failed to load notification preferences' }, { status: 500 });
    }

    let emailsSent = 0;
    let usersProcessed = 0;
    let skippedUsers = 0;
    let failedUsers = 0;
    let inAppDigestsCreated = 0;
    const sentAtIso = new Date().toISOString();

    for (const p of prefs || []) {
      // Tier is enforced here too: free users only get the weekly in-app digest, never e-mail.
      const subscription = await getUserSubscription(p.user_id);
      const isPlus = isStemmePlusActive(subscription);
      if (isPlus && (!p.email_enabled || !smtpConfigured)) continue;
      let channels: string[];
      if (!isPlus) {
        channels = frequency === 'weekly' ? [...NOTIFICATION_CHANNELS] : [];
      } else if (hasV2) {
        const v2 = normalizeNotificationPreferences(p as Record<string, unknown>, true);
        channels = v2.channel_email && v2.frequency === frequency ? [...NOTIFICATION_CHANNELS] : [];
      } else {
        channels = pickDigestChannels(
          (p.email_frequency_by_channel || {}) as Record<string, unknown>,
          frequency,
        );
      }
      if (channels.length === 0) continue;

      usersProcessed += 1;

      const items: Array<{
        title: string;
        body?: string | null;
        url?: string | null;
        createdAt: string;
        channel: string;
      }> = [];
      const lastDigest = (p.last_digest_sent_at_by_channel || {}) as Record<string, string>;
      let userQueryFailed = false;

      for (const channel of channels) {
        const sinceIso = resolveDigestSinceIso(lastDigest[channel]);

        const { data: notifs, error: notifsError } = await service
          .from('notifications')
          .select('title,body,url,created_at,channel')
          .eq('user_id', p.user_id)
          .eq('channel', channel)
          .gt('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(50);

        if (notifsError) {
          console.error('Cron digest notifications query error', {
            userId: p.user_id,
            channel,
            error: notifsError,
          });
          userQueryFailed = true;
          break;
        }

        for (const n of notifs || []) {
          items.push({
            title: n.title,
            body: n.body,
            url: toAbsoluteNotificationUrl(n.url, origin),
            createdAt: n.created_at,
            channel,
          });
        }
      }

      if (userQueryFailed) {
        failedUsers += 1;
        continue;
      }

      if (!shouldSendDigestEmail(items)) {
        skippedUsers += 1;
        continue;
      }

      if (!isPlus) {
        const summary = buildInAppDigestSummary(items);
        const { error: insertError } = await service.from('notifications').insert({
          user_id: p.user_id,
          type: 'weekly_digest',
          channel: 'digest',
          title: summary.title,
          body: summary.body,
          url: summary.url,
          data: { digest: true, frequency: 'weekly', count: items.length },
        });
        if (insertError) {
          failedUsers += 1;
          console.error('Cron digest in-app insert error', { userId: p.user_id, error: insertError });
          continue;
        }
        inAppDigestsCreated += 1;
        const { error: cursorError } = await service
          .from('notification_preferences')
          .update({ last_digest_sent_at_by_channel: buildDigestCursorUpdate(lastDigest, channels, sentAtIso) })
          .eq('user_id', p.user_id);
        if (cursorError) {
          console.error('Cron digest cursor update error', { userId: p.user_id, error: cursorError });
        }
        continue;
      }

      const userRes = await service.auth.admin.getUserById(p.user_id);
      const email = userRes.data.user?.email;
      if (!email) {
        skippedUsers += 1;
        continue;
      }

      const preparedDigest = prepareDigestForUser(items, subscription);

      try {
        await sendDigestEmail({ to: email, frequency, digest: preparedDigest });
        emailsSent += 1;

        const nextCursor = buildDigestCursorUpdate(lastDigest, channels, sentAtIso);
        const { error: updateError } = await service
          .from('notification_preferences')
          .update({ last_digest_sent_at_by_channel: nextCursor })
          .eq('user_id', p.user_id);

        if (updateError) {
          console.error('Cron digest cursor update error', {
            userId: p.user_id,
            error: updateError,
          });
        }
      } catch (e) {
        failedUsers += 1;
        console.error('Cron digest email send error', { userId: p.user_id, error: e });
      }
    }

    return NextResponse.json({
      ok: true,
      frequency,
      usersProcessed,
      emailsSent,
      skippedUsers,
      failedUsers,
      inAppDigestsCreated,
    });
  } catch (e) {
    console.error('Cron digest error', e);
    return NextResponse.json({ error: 'Cron error' }, { status: 500 });
  }
}
