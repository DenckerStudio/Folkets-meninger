import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { routes } from '@/lib/routes';

/** Site admin: membership in public.user_roles (role = admin). */
export async function isAdmin(userId: string, _email?: string | null): Promise<boolean> {
  if (!userId) return false;

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const service = getServiceSupabase();
    const { data, error } = await service
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    if (!error) return Boolean(data);
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
