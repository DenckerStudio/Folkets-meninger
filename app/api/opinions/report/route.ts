import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  isContentReportCategory,
  isContentReportTarget,
} from '@/lib/moderation/content-report';
import { trustedClientIp } from '@/lib/trusted-client-ip';

export const dynamic = 'force-dynamic';

/** POST /api/opinions/report — report an opinion or one of its replies. */
export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Du må være logget inn' }, { status: 401 });
  }

  const ipRate = await checkRateLimit(
    `opinion-report:ip:${trustedClientIp(request)}`,
    15,
    60_000,
  );
  if (!ipRate.ok) {
    return NextResponse.json(
      { error: 'For mange rapporter. Prøv igjen om litt.' },
      { status: 429, headers: { 'Retry-After': String(ipRate.retryAfterSeconds) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  const targetType = typeof body.targetType === 'string' ? body.targetType : '';
  const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';
  if (!isContentReportTarget(targetType) || !targetId) {
    return NextResponse.json({ error: 'Ugyldig mål for rapporten' }, { status: 400 });
  }

  const categoryRaw = typeof body.category === 'string' ? body.category.trim() : 'other';
  const category = isContentReportCategory(categoryRaw) ? categoryRaw : 'other';
  const details = typeof body.details === 'string' ? body.details.trim().slice(0, 500) : null;

  try {
    const service = getServiceSupabase();
    const { data, error } = await service.rpc('report_content', {
      p_reporter_user_id: user.id,
      p_target_type: targetType,
      p_target_id: targetId,
      p_category: category,
      p_details: details,
    });
    if (error) {
      console.error('report_content error:', error.message);
      return NextResponse.json({ error: 'Kunne ikke sende rapporten' }, { status: 500 });
    }
    return NextResponse.json({ success: true, reportId: String(data) });
  } catch (error) {
    console.error('opinion report error:', error);
    return NextResponse.json({ error: 'Kunne ikke sende rapporten' }, { status: 500 });
  }
}
