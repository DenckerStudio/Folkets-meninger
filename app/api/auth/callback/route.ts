import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ensurePublicUser } from '@/lib/ensure-public-user';
import { userHasPublicIdentityInDb } from '@/lib/identity/require-public-identity';
import {
  buildOnboardingUserMetadata,
  needsOnboarding,
  onboardingPathWithNext,
  readOnboardingMetadata,
} from '@/lib/onboarding';
import { sanitizePostLoginPath } from '@/lib/safe-redirect';
import { routes } from '@/lib/routes';

function requiresPublicIdentity(pathname: string): boolean {
  return pathname.startsWith(`${routes.horinger}/`) || pathname.startsWith('/dashboard/horinger/');
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizePostLoginPath(searchParams.get('next'));

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
      if (user) {
        const hasIdentity = await userHasPublicIdentityInDb(user.id);
        const metadata = readOnboardingMetadata(user);
        if (needsOnboarding({ metadata, hasPublicIdentity: hasIdentity })) {
          if (!metadata.pending && !metadata.completed) {
            await supabase.auth.updateUser({
              data: buildOnboardingUserMetadata({ pending: true }),
            });
          }
          return NextResponse.redirect(`${origin}${onboardingPathWithNext(next)}`);
        }
        if (requiresPublicIdentity(next) && !hasIdentity) {
          return NextResponse.redirect(`${origin}${onboardingPathWithNext(next)}`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
