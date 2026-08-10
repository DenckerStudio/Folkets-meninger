import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase-server';
import { routes } from '@/lib/routes';

function adminEmailAllowlist(): string[] {
  const raw =
    process.env.ADMIN_EMAILS?.trim() ||
    process.env.FORUM_ADMIN_EMAILS?.trim() ||
    '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Site admin: ADMIN_EMAILS allowlist and/or app_metadata.role === "admin". */
export async function isAdmin(userId: string, email?: string | null): Promise<boolean> {
  const allowlist = adminEmailAllowlist();
  if (email && allowlist.includes(email.toLowerCase())) {
    return true;
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return false;

  return user.app_metadata?.role === 'admin';
}

export async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; status: number; error: string }
> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: 'Du må være logget inn' };
  }

  const admin = await isAdmin(user.id, user.email);
  if (!admin) {
    return { ok: false, status: 403, error: 'Ingen tilgang' };
  }

  return { ok: true, userId: user.id };
}

export async function requireAdminPage(nextPath: string = routes.adminStats): Promise<void> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${routes.login}?next=${encodeURIComponent(nextPath)}`);
  }

  const admin = await isAdmin(user.id, user.email);
  if (!admin) {
    redirect(routes.utforsk);
  }
}
