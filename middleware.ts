import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, getRateLimitPolicy } from '@/lib/rate-limit';
import {
  isPublicDashboardAvstemningPath,
  isPublicDashboardInitiativPath,
  isPublicDashboardPolitikerPath,
  isPublicDashboardSakPath,
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
    isPublicDashboardInitiativPath(pathname)
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
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/vote/:path*',
    '/api/sak/:path*/ai-summary',
    '/api/feedback',
  ],
};
