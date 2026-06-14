import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ensurePublicUser } from "@/lib/ensure-public-user";
import { userHasForumIdentityInDb } from "@/lib/forum/require-forum-identity";
import { sanitizePostLoginPath } from "@/lib/safe-redirect";
import { isForumRelatedPath, routes } from "@/lib/routes";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizePostLoginPath(searchParams.get("next"));

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
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          await ensurePublicUser(user);
        } catch (e) {
          console.error('Failed to sync public.users on login', e);
        }
      }
      if (user && isForumRelatedPath(next)) {
        const hasIdentity = await userHasForumIdentityInDb(user.id);
        if (!hasIdentity) {
          const profileUrl = new URL(routes.completeProfile, origin);
          profileUrl.searchParams.set('next', next);
          return NextResponse.redirect(profileUrl.toString());
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
