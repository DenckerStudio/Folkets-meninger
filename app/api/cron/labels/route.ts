import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { createNotification } from '@/lib/notifications';
import { cronAuthResponse, verifyCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

async function getLastSeenUpdatedAt(): Promise<string | null> {
  const service = getServiceSupabase();
  const { data, error } = await service
    .schema('private')
    .from('app_settings')
    .select('value')
    .eq('key', 'labels_last_seen_updated_at_iso')
    .maybeSingle();
  if (error) return null;
  return data?.value ?? null;
}

async function setLastSeenUpdatedAt(value: string) {
  const service = getServiceSupabase();
  await service
    .schema('private')
    .from('app_settings')
    .upsert({ key: 'labels_last_seen_updated_at_iso', value }, { onConflict: 'key' });
}

async function userAlreadyNotifiedForIssue(userId: string, issueId: string): Promise<boolean> {
  const service = getServiceSupabase();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await service
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', since)
    .contains('data', { issueId })
    .limit(1);

  return (data?.length ?? 0) > 0;
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request);
  if (!auth.ok) {
    return cronAuthResponse(auth);
  }

  try {
    const origin = new URL(request.url).origin;
    const lastSeen = await getLastSeenUpdatedAt();
    const lastSeenIso = lastSeen ?? new Date(0).toISOString();

    const service = getServiceSupabase();
    const { data: summaries, error } = await service
      .from('issue_ai_summaries')
      .select('stortinget_issue_id, labels, updated_at')
      .gt('updated_at', lastSeenIso)
      .neq('labels', '{}')
      .order('updated_at', { ascending: true });

    if (error) {
      console.error('Cron labels query error', error);
      return NextResponse.json({ error: 'Query error' }, { status: 500 });
    }

    if (!summaries?.length) {
      return NextResponse.json({ ok: true, updatedSummaries: 0 });
    }

    const issueIds = summaries.map((s) => s.stortinget_issue_id);
    const { data: issues } = await service
      .from('stortinget_issues')
      .select('id, title')
      .in('id', issueIds);

    const titleById = new Map((issues || []).map((i) => [String(i.id), i.title]));

    const allLabels = [...new Set(summaries.flatMap((s) => s.labels ?? []))];
    const { data: subs } = await service
      .from('notification_label_subscriptions')
      .select('user_id, label')
      .in('label', allLabels);

    const byLabel = new Map<string, Set<string>>();
    for (const s of subs || []) {
      if (!byLabel.has(s.label)) byLabel.set(s.label, new Set());
      byLabel.get(s.label)!.add(s.user_id);
    }

    let created = 0;
    let failed = 0;
    let maxUpdatedAt = new Date(lastSeenIso).getTime();

    for (const summary of summaries) {
      const issueId = String(summary.stortinget_issue_id);
      const title = titleById.get(issueId) ?? 'Ny sak';
      const labels = summary.labels ?? [];
      const notifiedUsers = new Set<string>();

      for (const label of labels) {
        const userIds = byLabel.get(label);
        if (!userIds) continue;

        for (const userId of userIds) {
          if (notifiedUsers.has(userId)) continue;

          const alreadyNotified = await userAlreadyNotifiedForIssue(userId, issueId);
          if (alreadyNotified) continue;

          notifiedUsers.add(userId);
          const result = await createNotification({
            userId,
            type: 'new_case_for_label',
            channel: 'labels',
            title: `Ny sak: ${label}`,
            body: title,
            url: `/dashboard/sak/${issueId}`,
            data: { issueId, label, labels },
            origin,
          });
          if (result.ok) created += 1;
          else failed += 1;
        }
      }

      const updatedMs = new Date(summary.updated_at).getTime();
      if (updatedMs > maxUpdatedAt) maxUpdatedAt = updatedMs;
    }

    await setLastSeenUpdatedAt(new Date(maxUpdatedAt).toISOString());

    return NextResponse.json({
      ok: true,
      updatedSummaries: summaries.length,
      notificationsCreated: created,
      notificationsFailed: failed,
    });
  } catch (e) {
    console.error('Cron labels error', e);
    return NextResponse.json({ error: 'Cron error' }, { status: 500 });
  }
}
