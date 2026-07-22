import { isForumAdmin } from '@/lib/forum/admin';
import { isSakMeningPrompt } from '@/lib/forum/sak-mening';
import { getAnonSupabase } from '@/lib/supabase';
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

export async function requireForumPromptInteractionAccess(
  promptId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (await canViewForumReels()) {
    return { ok: true };
  }

  const supabase = getAnonSupabase();
  const { data: prompt } = await supabase
    .from('forum_prompts')
    .select('topic_tags')
    .eq('id', promptId)
    .maybeSingle();

  if (isSakMeningPrompt(prompt?.topic_tags)) {
    const authSupabase = await getServerSupabase();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();
    if (user) {
      return { ok: true };
    }
    return { ok: false, status: 401, error: 'Du må være logget inn' };
  }

  return {
    ok: false,
    status: 403,
    error: 'Spesielle saker er ikke tilgjengelig ennå',
  };
}
