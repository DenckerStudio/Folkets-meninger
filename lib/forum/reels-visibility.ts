import { isForumAdmin } from '@/lib/forum/admin';
import { getServerSupabase } from '@/lib/supabase-server';

/** When false (default), reels are visible only to forum admins until explicitly launched. */
export function isForumReelsPublicEnabled(): boolean {
  return process.env.FORUM_REELS_PUBLIC === 'true';
}

export async function canViewForumReels(): Promise<boolean> {
  if (isForumReelsPublicEnabled()) return true;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  return isForumAdmin(user.id, user.email);
}

export async function requireForumReelsAccess(): Promise<
  { ok: true } | { ok: false; status: number; error: string }
> {
  if (await canViewForumReels()) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    error: 'Spesielle saker er ikke tilgjengelig ennå',
  };
}
