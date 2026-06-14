import { getServerSupabase } from '@/lib/supabase-server';

/** Display name for forum threads with is_system_thread and no author_user_id. */
export const FORUM_SYSTEM_AUTHOR_NAME = 'Folkets Stemme';

export async function isForumAdmin(userId: string, email?: string | null): Promise<boolean> {
  const allowlist = process.env.FORUM_ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()) ?? [];
  if (email && allowlist.includes(email.toLowerCase())) {
    return true;
  }

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return false;

  const role = user.app_metadata?.role;
  return role === 'admin';
}

export async function requireForumAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; status: number; error: string }
> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: 'Du må være logget inn' };
  }

  const admin = await isForumAdmin(user.id, user.email);
  if (!admin) {
    return { ok: false, status: 403, error: 'Ingen tilgang' };
  }

  return { ok: true, userId: user.id };
}
