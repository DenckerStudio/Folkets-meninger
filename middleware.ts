import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, getRateLimitPolicy } from '@/lib/rate-limit';
import {
  isPublicDashboardAvstemningPath,
  isPublicDashboardChatPath,
  isPublicDashboardFolketsMeningerPath,
  isPublicDashboardPolitikerPath,
  isPublicDashboardSakPath,
  isPublicDashboardUtforskPath,
  routes,
} from '@/lib/routes';
import { refreshSessionCookies, resolveMiddlewareUser } from '@/lib/supabase-middleware';

function applyRateLimit(request: NextRequest, pathname: string): NextResponse | null {
  const ratePolicy = getRateLimitPolicy(pathname);
  if (!ratePolicy) {
    return null;
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const rate = checkRateLimit(`${pathname}:${ip}`, ratePolicy.limit, ratePolicy.windowMs);
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'For mange forespørsler. Prøv igjen om litt.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfterSeconds) },
      },
    );
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const rateLimited = applyRateLimit(request, pathname);
  if (rateLimited) {
    return rateLimited;
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (
    isPublicDashboardSakPath(pathname) ||
    isPublicDashboardPolitikerPath(pathname) ||
    isPublicDashboardAvstemningPath(pathname) ||
    isPublicDashboardFolketsMeningerPath(pathname) ||
    isPublicDashboardUtforskPath(pathname) ||
    isPublicDashboardChatPath(pathname)
  ) {
    return refreshSessionCookies(request);
  }

  const isDashboard = pathname === routes.dashboard || pathname.startsWith(`${routes.dashboard}/`);
  if (!isDashboard) {
    return NextResponse.next();
  }

  const { user, response } = await resolveMiddlewareUser(request);
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = routes.login;
    // Preserve query (e.g. ?sak=&chat=1) so post-login can reopen context.
    loginUrl.search = '';
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/vote/:path*',
    '/api/sak/:path*/ai-summary',
    '/api/sak/:path*/impact',
    '/api/sak/:path*/knowledge',
    '/api/sak/:path*/counter-proposals',
    '/api/opinions/:path*',
    '/api/feedback',
    '/api/oauth/fider/:path*',
    '/api/chat',
    '/api/chat/:path*',
    '/api/byok',
    '/api/stemme-plus/checkout',
    '/api/stemme-plus/portal',
  ],
};
