import { getServerSupabase } from '@/lib/supabase-server';
import { stripUrlsForExcerpt } from '@/lib/forum/format-body';
import { formatTimeAgo } from '@/lib/forum/queries';

export type MineInnleggThreadItem = {
  kind: 'thread';
  id: string;
  threadId: string;
  title: string;
  excerpt: string;
  createdAt: string;
  createdAtLabel: string;
  replyCount: number;
  likeCount: number;
};

export type MineInnleggReplyItem = {
  kind: 'reply';
  id: string;
  threadId: string;
  threadTitle: string;
  excerpt: string;
  createdAt: string;
  createdAtLabel: string;
  likeCount: number;
};

export type MineInnleggItem = MineInnleggThreadItem | MineInnleggReplyItem;

const PAGE_SIZE = 20;

function excerptBody(body: string, max = 140): string {
  const stripped = stripUrlsForExcerpt(body);
  const t = stripped.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export async function getUserForumPosts(
  userId: string,
  page = 1,
): Promise<{ items: MineInnleggItem[]; page: number; hasMore: boolean }> {
  const supabase = await getServerSupabase();
  const offset = (Math.max(1, page) - 1) * PAGE_SIZE;
  const fetchLimit = PAGE_SIZE + 1;

  const { data: threads } = await supabase
    .from('forum_threads')
    .select('id, title, body, created_at')
    .eq('author_user_id', userId)
    .eq('is_system_thread', false)
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  const { data: replies } = await supabase
    .from('forum_replies')
    .select('id, body, thread_id, created_at, forum_threads ( title )')
    .eq('author_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  type Row = { created_at: string; item: MineInnleggItem };
  const combined: Row[] = [];

  const threadIds = (threads ?? []).map((t) => t.id);
  const replyIds = (replies ?? []).map((r) => r.id);

  const likeCounts = await countLikes(supabase, threadIds, replyIds);
  const replyCounts = await countRepliesPerThread(supabase, threadIds);

  for (const t of threads ?? []) {
    combined.push({
      created_at: t.created_at,
      item: {
        kind: 'thread',
        id: t.id,
        threadId: t.id,
        title: t.title,
        excerpt: excerptBody(t.body),
        createdAt: t.created_at,
        createdAtLabel: formatTimeAgo(t.created_at),
        replyCount: replyCounts.get(t.id) ?? 0,
        likeCount: likeCounts.get(`thread:${t.id}`) ?? 0,
      },
    });
  }

  for (const r of replies ?? []) {
    const threadJoin = r.forum_threads as { title?: string } | { title?: string }[] | null;
    const threadTitle = Array.isArray(threadJoin)
      ? threadJoin[0]?.title
      : threadJoin?.title;

    combined.push({
      created_at: r.created_at,
      item: {
        kind: 'reply',
        id: r.id,
        threadId: r.thread_id,
        threadTitle: threadTitle ?? 'Tråd',
        excerpt: excerptBody(r.body),
        createdAt: r.created_at,
        createdAtLabel: formatTimeAgo(r.created_at),
        likeCount: likeCounts.get(`reply:${r.id}`) ?? 0,
      },
    });
  }

  combined.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const slice = combined.slice(offset, offset + PAGE_SIZE);
  const hasMore = combined.length > offset + PAGE_SIZE;

  return {
    items: slice.map((r) => r.item),
    page: Math.max(1, page),
    hasMore,
  };
}

async function countLikes(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  threadIds: string[],
  replyIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (threadIds.length > 0) {
    const { data } = await supabase
      .from('forum_likes')
      .select('target_id')
      .eq('target_type', 'thread')
      .in('target_id', threadIds);
    for (const row of data ?? []) {
      const key = `thread:${row.target_id}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  if (replyIds.length > 0) {
    const { data } = await supabase
      .from('forum_likes')
      .select('target_id')
      .eq('target_type', 'reply')
      .in('target_id', replyIds);
    for (const row of data ?? []) {
      const key = `reply:${row.target_id}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return counts;
}

async function countRepliesPerThread(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  threadIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (threadIds.length === 0) return counts;

  const { data } = await supabase
    .from('forum_replies')
    .select('thread_id')
    .in('thread_id', threadIds);

  for (const row of data ?? []) {
    counts.set(row.thread_id, (counts.get(row.thread_id) ?? 0) + 1);
  }
  return counts;
}
