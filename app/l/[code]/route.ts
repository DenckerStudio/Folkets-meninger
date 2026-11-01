import { NextResponse } from 'next/server';
import { trustedClientIp } from '@/lib/analytics/client-ip';
import { shouldRecordShareClick } from '@/lib/analytics/share-click';
import { resolveShareTarget } from '@/lib/polls/share-personal';
import { checkRateLimit } from '@/lib/rate-limit';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const CODE_RE = /^[A-Za-z0-9]{1,64}$/;
const SHARE_CLICK_WINDOW_MS = 60_000;
const SHARE_CLICK_IP_LIMIT = 60;
const SHARE_CLICK_CODE_LIMIT = 120;

function redirectHome(request: Request): NextResponse {
  return NextResponse.redirect(new URL('/', request.url), 302);
}

function sameOriginLocation(path: string, code: string, requestUrl: string): URL | null {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('//')) {
    return null;
  }
  let request: URL;
  let location: URL;
  try {
    request = new URL(requestUrl);
    location = new URL(path, request);
  } catch {
    return null;
  }
  if (location.origin !== request.origin) return null;
  if (!location.pathname.startsWith('/') || location.pathname.includes('//')) return null;
  location.search = '';
  location.searchParams.set('fm_share', code);
  return location;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!CODE_RE.test(code)) return redirectHome(request);

  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  ) {
    return redirectHome(request);
  }

  const service = getServiceSupabase();
  const { data, error } = await service
    .from('share_links')
    .select('id, target_kind, target_id')
    .eq('code', code)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) {
    console.error(`share link lookup failed: ${error.code ?? 'unknown'}`);
    return redirectHome(request);
  }
  if (!data || typeof data.id !== 'string') return redirectHome(request);

  const targetKind = typeof data.target_kind === 'string' ? data.target_kind : '';
  const targetId = typeof data.target_id === 'string' ? data.target_id : '';
  const path = resolveShareTarget(targetKind, targetId);
  const location = path ? sameOriginLocation(path, code, request.url) : null;
  if (!location) return redirectHome(request);

  // Klikktallet i delingspanelet skal telles også når offentlig analyse er av.
  // Over grensen hopper vi over innsettingen og sender besøkende videre.
  const ip = trustedClientIp(request);
  const ipRate = await checkRateLimit(
    `share-click:ip:${ip}`,
    SHARE_CLICK_IP_LIMIT,
    SHARE_CLICK_WINDOW_MS,
  );
  const codeRate = ipRate.ok
    ? await checkRateLimit(
        `share-click:code:${code}`,
        SHARE_CLICK_CODE_LIMIT,
        SHARE_CLICK_WINDOW_MS,
      )
    : ipRate;
  if (shouldRecordShareClick(ipRate, codeRate)) {
    const { error: insertError } = await service.rpc('insert_analytics_event', {
      p_row: {
        event_name: 'share_link_click',
        path: `/l/${code}`,
        share_link_id: data.id,
        session_hash: null,
        metadata: {},
      },
    });
    if (insertError) {
      console.error(`share_link_click insert failed: ${insertError.code ?? 'unknown'}`);
    }
  }

  const response = NextResponse.redirect(location, 302);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
