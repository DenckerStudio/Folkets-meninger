import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  buildAuthCallbackFailureRedirect,
  buildAuthCallbackSuccessRedirect,
  buildCompleteProfileRedirect,
  buildOnboardingRedirect,
  resolveAuthCallbackNext,
} from '@/lib/auth/oauth-callback-redirect';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { userHasPublicIdentityInDb } from '@/lib/identity/require-public-identity';
import { shouldStartSignupOnboarding } from '@/lib/onboarding';
import { routes } from '@/lib/routes';

function requiresPublicIdentity(pathname: string): boolean {
  return pathname.startsWith(`${routes.horinger}/`) || pathname.startsWith('/dashboard/horinger/');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = resolveAuthCallbackNext(searchParams.get('next'));

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        try {
          await ensurePublicUser(user);
        } catch (e) {
          console.error('Failed to sync public.users on login', e);
        }
      }
      if (user && requiresPublicIdentity(next)) {
        const hasIdentity = await userHasPublicIdentityInDb(user.id);
        if (!hasIdentity) {
          return NextResponse.redirect(buildCompleteProfileRedirect(next));
        }
      }
      if (user && shouldStartSignupOnboarding(user)) {
        return NextResponse.redirect(buildOnboardingRedirect(next));
      }
      return NextResponse.redirect(buildAuthCallbackSuccessRedirect(next));
    }
  }

  return NextResponse.redirect(buildAuthCallbackFailureRedirect());
}
