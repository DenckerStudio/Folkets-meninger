import { NextResponse } from 'next/server';
import { getSaker } from '@/lib/stortinget';
import { getServiceSupabase } from '@/lib/supabase';
import { createNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

function assertCronAuth(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    throw new Error('CRON_SECRET is not configured');
  }
  const provided = request.headers.get('x-cron-secret');
  if (!provided || provided !== expected) {
    return false;
  }
  return true;
}

async function getLastSeenDateIso(): Promise<string | null> {
  const service = getServiceSupabase();
  const { data, error } = await service
    .schema('private')
    .from('app_settings')
    .select('value')
    .eq('key', 'categories_last_seen_date_iso')
    .maybeSingle();
  if (error) return null;
  return data?.value ?? null;
}

async function setLastSeenDateIso(value: string) {
  const service = getServiceSupabase();
  await service
    .schema('private')
    .from('app_settings')
    .upsert({ key: 'categories_last_seen_date_iso', value }, { onConflict: 'key' });
}

export async function GET(request: Request) {
  try {
    if (!assertCronAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const origin = new URL(request.url).origin;
    const lastSeen = await getLastSeenDateIso();
    const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;

    const issues = await getSaker();
    const fresh = issues.filter((i) => new Date(i.date).getTime() > lastSeenMs);

    if (fresh.length === 0) {
      return NextResponse.json({ ok: true, newIssues: 0 });
    }

    const service = getServiceSupabase();

    const categories = [...new Set(fresh.map((i) => i.category).filter(Boolean))];
    const { data: subs } = await service
      .from('notification_category_subscriptions')
      .select('user_id,category')
      .in('category', categories);

    const byCategory = new Map<string, Set<string>>();
    for (const s of subs || []) {
      if (!byCategory.has(s.category)) byCategory.set(s.category, new Set());
      byCategory.get(s.category)!.add(s.user_id);
    }

    let created = 0;
    for (const issue of fresh) {
      const userIds = byCategory.get(issue.category);
      if (!userIds || userIds.size === 0) continue;

      await Promise.all(
        [...userIds].map(async (userId) => {
          created += 1;
          return createNotification({
            userId,
            type: 'new_case_in_category',
            channel: 'categories',
            title: `Ny sak i ${issue.category}`,
            body: issue.title,
            url: `/dashboard/sak/${issue.id}`,
            data: { issueId: issue.id, category: issue.category, status: issue.status, date: issue.date },
            origin,
          });
        })
      );
    }

    const maxDate = fresh
      .map((i) => new Date(i.date).getTime())
      .reduce((a, b) => Math.max(a, b), lastSeenMs);
    await setLastSeenDateIso(new Date(maxDate).toISOString());

    return NextResponse.json({ ok: true, newIssues: fresh.length, notificationsCreated: created });
  } catch (e) {
    console.error('Cron categories error', e);
    return NextResponse.json({ error: 'Cron error' }, { status: 500 });
  }
}

