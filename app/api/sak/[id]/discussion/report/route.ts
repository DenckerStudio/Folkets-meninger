import { NextResponse } from 'next/server';
import {
  discussionPostBelongsToIssue,
  reportDiscussionPost,
} from '@/lib/discussion/service';
import {
  CONTENT_REPORT_CATEGORIES,
  type ContentReportCategory,
} from '@/lib/discussion/types';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isReportCategory(value: string): value is ContentReportCategory {
  return (CONTENT_REPORT_CATEGORIES as readonly string[]).includes(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: issueId } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  const ipRate = checkRateLimit(`discussion:report:ip:${clientIp(request)}`, 15, 60_000);
  if (!ipRate.ok) {
    return NextResponse.json(
      { error: 'For mange rapporter. Prøv igjen om litt.' },
      {
        status: 429,
        headers: { 'Retry-After': String(ipRate.retryAfterSeconds) },
      },
    );
  }

  const userRate = checkRateLimit(`discussion:report:user:${user.id}`, 10, 60_000);
  if (!userRate.ok) {
    return NextResponse.json(
      { error: 'Du har sendt for mange rapporter. Vent litt.' },
      {
        status: 429,
        headers: { 'Retry-After': String(userRate.retryAfterSeconds) },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  const postId = typeof body.postId === 'string' ? body.postId.trim() : '';
  if (!postId) {
    return NextResponse.json({ error: 'Mangler innlegg-ID' }, { status: 400 });
  }

  const categoryRaw = typeof body.category === 'string' ? body.category.trim() : 'other';
  const category = isReportCategory(categoryRaw) ? categoryRaw : 'other';
  const details = typeof body.details === 'string' ? body.details.trim().slice(0, 500) : null;

  const belongs = await discussionPostBelongsToIssue(postId, issueId);
  if (!belongs) {
    return NextResponse.json({ error: 'Innlegget finnes ikke på denne saken' }, { status: 404 });
  }

  try {
    const reportId = await reportDiscussionPost(user.id, postId, category, details);
    return NextResponse.json({ success: true, reportId });
  } catch (error) {
    console.error('Report discussion post error:', error);
    return NextResponse.json({ error: 'Kunne ikke sende rapporten' }, { status: 500 });
  }
}
