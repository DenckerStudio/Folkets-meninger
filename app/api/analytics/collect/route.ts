import { NextResponse } from 'next/server';
import { isAnalyticsEnabled } from '@/lib/analytics/flags';
import {
  buildAnalyticsInsertRow,
  computeSessionHash,
  parseCollectPayload,
  utcDateString,
} from '@/lib/analytics/collect-server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

async function resolveShareLinkId(shareCode: string | null): Promise<string | null> {
  if (!shareCode) {
    return null;
  }
  try {
    const service = getServiceSupabase();
    const { data, error } = await service
      .from('share_links')
      .select('id')
      .eq('code', shareCode)
      .is('revoked_at', null)
      .maybeSingle();
    if (error || !data?.id) {
      return null;
    }
    return data.id as string;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isAnalyticsEnabled()) {
    return new NextResponse(null, { status: 204 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new NextResponse(null, { status: 204 });
  }

  const ip = clientIp(request);
  const ipRate = await checkRateLimit(`analytics-collect:ip:${ip}`, 60, 60_000);
  if (!ipRate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler' },
      {
        status: 429,
        headers: { 'Retry-After': String(ipRate.retryAfterSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  const parsed = parseCollectPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  }

  const userAgent = request.headers.get('user-agent') ?? '';
  const sessionHash = computeSessionHash({
    secret: process.env.ANALYTICS_COLLECT_SECRET,
    ip,
    userAgent,
    utcDate: utcDateString(),
  });

  const shareLinkId = await resolveShareLinkId(parsed.value.shareCode);

  const row = buildAnalyticsInsertRow({
    payload: parsed.value,
    shareLinkId,
    sessionHash,
  });

  const service = getServiceSupabase();
  const { error } = await service.rpc('insert_analytics_event', { p_row: row });
  if (error) {
    console.error(`analytics collect insert failed: ${error.code ?? error.message}`);
  }

  return new NextResponse(null, { status: 204 });
}
