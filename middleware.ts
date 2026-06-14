import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, getRateLimitPolicy } from '@/lib/rate-limit';
import { isPublicDashboardSakPath, routes } from '@/lib/routes';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  const ratePolicy = getRateLimitPolicy(pathname);
  if (ratePolicy) {
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
        }
      );
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboard = pathname === routes.dashboard || pathname.startsWith(`${routes.dashboard}/`);

  if (isDashboard && !isPublicDashboardSakPath(pathname)) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = routes.login;
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
