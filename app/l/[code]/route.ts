import { NextResponse } from 'next/server';
import { resolveShareTarget } from '@/lib/polls/share-personal';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const CODE_RE = /^[A-Za-z0-9]{1,64}$/;

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

function sameOriginLocation(path: string, requestUrl: string): URL | null {
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
  return location;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!CODE_RE.test(code)) return notFound();

  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  ) {
    return NextResponse.json({ error: 'Serveren er ikke konfigurert' }, { status: 503 });
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
    return notFound();
  }
  if (!data || typeof data.id !== 'string') return notFound();

  const targetKind = typeof data.target_kind === 'string' ? data.target_kind : '';
  const targetId = typeof data.target_id === 'string' ? data.target_id : '';
  const path = resolveShareTarget(targetKind, targetId);
  const location = path ? sameOriginLocation(path, request.url) : null;
  if (!location) return notFound();

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

  const response = NextResponse.redirect(location, 302);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
