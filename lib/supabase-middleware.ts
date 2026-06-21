import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

const MIDDLEWARE_AUTH_TIMEOUT_MS = 3_500;

type MiddlewareSupabaseClient = ReturnType<typeof createServerClient>;

export function hasSupabaseAuthCookies(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'),
  );
}

export function createMiddlewareSupabaseClient(
  request: NextRequest,
  response: NextResponse,
): { supabase: MiddlewareSupabaseClient; getResponse: () => NextResponse } {
  let supabaseResponse = response;

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

  return {
    supabase,
    getResponse: () => supabaseResponse,
  };
}

async function getUserWithTimeout(supabase: MiddlewareSupabaseClient): Promise<User | null> {
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('MIDDLEWARE_AUTH_TIMEOUT')), MIDDLEWARE_AUTH_TIMEOUT_MS);
      }),
    ]);

    return result.data.user;
  } catch (error) {
    if (error instanceof Error && error.message === 'MIDDLEWARE_AUTH_TIMEOUT') {
      console.warn('[middleware] getUser timed out; falling back to getSession');
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user ?? null;
  }
}

export async function refreshSessionCookies(
  request: NextRequest,
): Promise<NextResponse> {
  if (!hasSupabaseAuthCookies(request)) {
    return NextResponse.next({ request });
  }

  const initialResponse = NextResponse.next({ request });
  const { supabase, getResponse } = createMiddlewareSupabaseClient(request, initialResponse);
  await supabase.auth.getSession();
  return getResponse();
}

export async function resolveMiddlewareUser(
  request: NextRequest,
): Promise<{ user: User | null; response: NextResponse }> {
  const initialResponse = NextResponse.next({ request });
  const { supabase, getResponse } = createMiddlewareSupabaseClient(request, initialResponse);
  const user = await getUserWithTimeout(supabase);
  return { user, response: getResponse() };
}
