import { getServiceSupabase } from '@/lib/supabase';
import { formatTimeAgo } from '@/lib/forum/queries';
import { stripUrlsForExcerpt } from '@/lib/forum/format-body';
import { getUserPointsProfile } from '@/lib/user-points-profile';
import type { UserPointsProgress } from '@/lib/user-points-levels';

export type PublicProfileActivity =
  | {
      kind: 'thread';
      id: string;
      threadId: string;
      title: string;
      excerpt: string;
      createdAt: string;
      createdAtLabel: string;
    }
  | {
      kind: 'reply';
      id: string;
      threadId: string;
      threadTitle: string;
      excerpt: string;
      createdAt: string;
      createdAtLabel: string;
    };

export type PublicProfile = {
  id: string;
  displayName: string;
  initials: string;
  isPublic: boolean;
  bio: string | null;
  partyPreference: string | null;
  points: number;
  pointsProgress: UserPointsProgress;
  activity: PublicProfileActivity[];
  stats: {
    threads: number;
    replies: number;
  };
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function excerpt(text: string, max = 180): string {
  const stripped = stripUrlsForExcerpt(text);
  const t = stripped.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const service = getServiceSupabase();
  let { data: user, error: userError } = await service
    .from('users')
    .select('id, first_name, last_name, name, bio, party_preference, profile_is_public, show_party_preference')
    .eq('id', userId)
    .maybeSingle();

  if (userError) {
    const fallback = await service
      .from('users')
      .select('id, first_name, last_name, name')
      .eq('id', userId)
      .maybeSingle();
    user = fallback.data
      ? {
          ...fallback.data,
          bio: null,
          party_preference: null,
          profile_is_public: false,
          show_party_preference: false,
        }
      : null;
  }

  if (!user) return null;

  const displayName =
    user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`.trim()
      : user.name || 'Bruker';

  const [threadsResRaw, repliesResRaw, pointsProfile] = await Promise.all([
    service
      .from('forum_threads')
      .select('id, title, body, created_at')
      .eq('author_user_id', userId)
      .eq('is_system_thread', false)
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(20),
    service
      .from('forum_replies')
      .select('id, body, thread_id, created_at, forum_threads ( title )')
      .eq('author_user_id', userId)
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(20),
    getUserPointsProfile(userId, 0),
  ]);

  const threadsRes = threadsResRaw.error
    ? await service
        .from('forum_threads')
        .select('id, title, body, created_at')
        .eq('author_user_id', userId)
        .eq('is_system_thread', false)
        .order('created_at', { ascending: false })
        .limit(20)
    : threadsResRaw;
  const repliesRes = repliesResRaw.error
    ? await service
        .from('forum_replies')
        .select('id, body, thread_id, created_at, forum_threads ( title )')
        .eq('author_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
    : repliesResRaw;

  const activity: PublicProfileActivity[] = [];

  for (const t of threadsRes.data ?? []) {
    activity.push({
      kind: 'thread',
      id: t.id,
      threadId: t.id,
      title: t.title,
      excerpt: excerpt(t.body),
      createdAt: t.created_at,
      createdAtLabel: formatTimeAgo(t.created_at),
    });
  }

  for (const r of repliesRes.data ?? []) {
    const threadJoin = r.forum_threads as { title?: string } | { title?: string }[] | null;
    const threadTitle = Array.isArray(threadJoin) ? threadJoin[0]?.title : threadJoin?.title;
    activity.push({
      kind: 'reply',
      id: r.id,
      threadId: r.thread_id,
      threadTitle: threadTitle ?? 'Tråd',
      excerpt: excerpt(r.body),
      createdAt: r.created_at,
      createdAtLabel: formatTimeAgo(r.created_at),
    });
  }

  activity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    id: user.id,
    displayName,
    initials: initialsFromName(displayName),
    isPublic: user.profile_is_public === true,
    bio: user.profile_is_public ? user.bio ?? null : null,
    partyPreference:
      user.profile_is_public && user.show_party_preference ? user.party_preference ?? null : null,
    points: pointsProfile.points,
    pointsProgress: pointsProfile.progress,
    activity: activity.slice(0, 20),
    stats: {
      threads: threadsRes.data?.length ?? 0,
      replies: repliesRes.data?.length ?? 0,
    },
  };
}
