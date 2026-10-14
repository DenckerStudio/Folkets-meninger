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
  const ratePolicy = getRateLimitPolicy(pathname, request.method);
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

  // Share + embed pages are public, but keep the session fresh so an expired
  // token does not make a logged-in voter look logged out.
  if (pathname.startsWith('/del/') || pathname.startsWith('/embed/')) {
    return refreshSessionCookies(request);
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
    '/api/opinions/:path*',
    '/api/feedback',
    '/api/suggestions',
    '/api/suggestions/:path*',
    '/api/chat',
    '/api/chat/:path*',
    '/api/byok',
    '/api/polls',
    '/del/:path*',
    '/embed/:path*',
    '/api/stemme-plus/checkout',
    '/api/stemme-plus/portal',
  ],
};
