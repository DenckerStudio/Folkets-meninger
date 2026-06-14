import { getAnonSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';
import { resolveForumAuthor, type ForumAuthorDisplay } from '@/lib/forum/author-display';
import type { ForumContextItem } from '@/lib/forum/context';
import { stripUrlsForExcerpt } from '@/lib/forum/format-body';
import { parseContextItemsFromBody, parseContextItemsJson } from '@/lib/forum/parse-context-lines';

type UserJoin =
  | { first_name: string | null; last_name: string | null; name: string | null }
  | { first_name: string | null; last_name: string | null; name: string | null }[]
  | null;

export function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Akkurat nå';
  if (diffMins < 60) return `${diffMins} min siden`;
  if (diffHours < 24) return `${diffHours} timer siden`;
  if (diffDays === 1) return '1 dag siden';
  return `${diffDays} dager siden`;
}

export function formatForumDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'Akkurat nå';
  if (diffHours < 24) {
    return `I dag kl. ${date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffHours < 48) {
    return `I går kl. ${date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export type ForumSort = 'nyeste' | 'engasjert';

/** Min. 2 tegn; fjerner tegn som bryter PostgREST `ilike`-filter. */
export function forumSearchPattern(q: string | null | undefined): string | null {
  const trimmed = q?.trim() ?? '';
  if (trimmed.length < 2) return null;
  const safe = trimmed
    .slice(0, 100)
    .replace(/[%_,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (safe.length < 2) return null;
  // Mellomrom → % slik at PostgREST `.or()`-filter ikke brytes
  const core = safe.replace(/\s+/g, '%');
  return `%${core}%`;
}

export type ForumThreadListItem = {
  id: string;
  title: string;
  author: ForumAuthorDisplay | null;
  createdAt: string;
  createdAtRaw: string;
  replies: number;
  likes: number;
  relatedIssueId: string | null;
  relatedIssueTitle: string | null;
  isResolved: boolean;
  bodyExcerpt: string;
  contextItems: ForumContextItem[];
};

function engagementScore(likes: number, replies: number, createdAtRaw: string): number {
  const ageMs = Date.now() - new Date(createdAtRaw).getTime();
  const recencyBoost = ageMs < 48 * 60 * 60 * 1000 ? 3 : 0;
  return likes * 2 + replies + recencyBoost;
}

function mergeContextItems(body: string, jsonItems: unknown): ForumContextItem[] {
  const fromJson = parseContextItemsJson(jsonItems);
  const fromBody = parseContextItemsFromBody(body).items;
  const seen = new Set<string>();
  const merged: ForumContextItem[] = [];

  for (const item of [...fromJson, ...fromBody]) {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export async function getForumThreads(options?: {
  sakId?: string | null;
  sort?: ForumSort;
  search?: string | null;
  limit?: number;
}): Promise<ForumThreadListItem[]> {
  const sakId = options?.sakId?.trim() || null;
  const sort = options?.sort ?? 'nyeste';
  const searchPattern = forumSearchPattern(options?.search);
  const limit = options?.limit ?? 20;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }

  try {
    const supabase = getAnonSupabase();
    let query = supabase
      .from('forum_threads')
      .select(`
        id,
        title,
        body,
        stortinget_issue_id,
        is_resolved,
        created_at,
        author_user_id,
        is_system_thread,
        context_items,
        users:author_user_id (first_name, last_name, name)
      `)
      .order('created_at', { ascending: false })
      .limit(sort === 'engasjert' ? 50 : limit);

    if (sakId) {
      query = query.eq('stortinget_issue_id', sakId);
    }

    if (searchPattern) {
      query = query.or(`title.ilike.${searchPattern},body.ilike.${searchPattern}`);
    }

    const { data: threads, error } = await query;

    if (error) {
      console.error('Error fetching forum threads:', error);
      return [];
    }

    const threadIds = (threads || []).map((t) => t.id);
    const issueIds = [...new Set((threads || []).map((t) => t.stortinget_issue_id).filter(Boolean))] as string[];

    const replyCounts: Record<string, number> = {};
    const likeCounts: Record<string, number> = {};
    const issueTitles: Record<string, string> = {};

    if (threadIds.length > 0) {
      const { data: replies } = await supabase
        .from('forum_replies')
        .select('thread_id')
        .in('thread_id', threadIds);

      for (const r of replies || []) {
        replyCounts[r.thread_id] = (replyCounts[r.thread_id] || 0) + 1;
      }

      const { data: likes } = await supabase
        .from('forum_likes')
        .select('target_id')
        .eq('target_type', 'thread')
        .in('target_id', threadIds);

      for (const l of likes || []) {
        likeCounts[l.target_id] = (likeCounts[l.target_id] || 0) + 1;
      }
    }

    if (issueIds.length > 0) {
      const { data: issues } = await supabase
        .from('stortinget_issues')
        .select('id, title')
        .in('id', issueIds);

      for (const issue of issues || []) {
        if (issue.title) issueTitles[issue.id] = issue.title;
      }
    }

    let items = (threads || []).map((thread) => {
      const { cleanBody } = parseContextItemsFromBody(thread.body);
      return {
        id: thread.id,
        title: thread.title,
        author: resolveForumAuthor({
          isSystemThread: thread.is_system_thread,
          users: thread.users as UserJoin,
        }),
        createdAt: formatTimeAgo(thread.created_at),
        createdAtRaw: thread.created_at,
        replies: replyCounts[thread.id] || 0,
        likes: likeCounts[thread.id] || 0,
        relatedIssueId: thread.stortinget_issue_id,
        relatedIssueTitle: thread.stortinget_issue_id
          ? issueTitles[thread.stortinget_issue_id] ?? null
          : null,
        isResolved: thread.is_resolved,
        bodyExcerpt: stripUrlsForExcerpt(cleanBody, 180),
        contextItems: mergeContextItems(thread.body, thread.context_items),
      };
    });

    if (sort === 'engasjert') {
      items = items
        .sort(
          (a, b) =>
            engagementScore(b.likes, b.replies, b.createdAtRaw) -
            engagementScore(a.likes, a.replies, a.createdAtRaw)
        )
        .slice(0, limit);
    }

    return items;
  } catch (e) {
    console.error('Failed to fetch forum threads:', e);
    return [];
  }
}

export type ForumReplyItem = {
  id: string;
  author: ForumAuthorDisplay | null;
  content: string;
  createdAt: string;
  likes: number;
  isVerifiedPolitician: boolean;
  isOfficialResponse: boolean;
};

export type ForumThreadDetail = {
  id: string;
  title: string;
  content: string;
  author: ForumAuthorDisplay | null;
  isSystemThread: boolean;
  createdAt: string;
  likes: number;
  threadLiked: boolean;
  relatedIssueId: string | null;
  relatedIssueTitle: string | null;
  contextItems: ForumContextItem[];
  replies: ForumReplyItem[];
  replyLikedIds: string[];
};

export async function getForumThread(id: string): Promise<ForumThreadDetail | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  try {
    const supabase = getAnonSupabase();
    const { data: thread, error } = await supabase
      .from('forum_threads')
      .select(`
        id,
        title,
        body,
        stortinget_issue_id,
        is_resolved,
        created_at,
        author_user_id,
        is_system_thread,
        context_items,
        users:author_user_id (first_name, last_name, name)
      `)
      .eq('id', id)
      .single();

    if (error || !thread) return null;

    const { cleanBody } = parseContextItemsFromBody(thread.body);

    const { data: likes } = await supabase
      .from('forum_likes')
      .select('user_id')
      .eq('target_type', 'thread')
      .eq('target_id', thread.id);

    const { data: replies } = await supabase
      .from('forum_replies')
      .select(`
        id,
        body,
        is_official_response,
        created_at,
        author_user_id,
        users:author_user_id (first_name, last_name, name)
      `)
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true });

    const replyLikeCounts: Record<string, number> = {};
    const replyIds = (replies || []).map((r) => r.id);

    if (replyIds.length > 0) {
      const { data: replyLikes } = await supabase
        .from('forum_likes')
        .select('target_id')
        .eq('target_type', 'reply')
        .in('target_id', replyIds);

      for (const l of replyLikes || []) {
        replyLikeCounts[l.target_id] = (replyLikeCounts[l.target_id] || 0) + 1;
      }
    }

    const politicianUserIds = new Set<string>();
    if (replies && replies.length > 0) {
      const authorIds = [...new Set(replies.map((r) => r.author_user_id))];
      const { data: profiles } = await supabase
        .from('politician_profiles')
        .select('user_id')
        .in('user_id', authorIds);

      for (const p of profiles || []) {
        politicianUserIds.add(p.user_id);
      }
    }

    let relatedIssueTitle: string | null = null;
    if (thread.stortinget_issue_id) {
      const { data: issue } = await supabase
        .from('stortinget_issues')
        .select('title')
        .eq('id', thread.stortinget_issue_id)
        .single();
      relatedIssueTitle = issue?.title ?? null;
    }

    let threadLiked = false;
    const replyLikedIds: string[] = [];

    const authSupabase = await getServerSupabase();
    const { data: { user } } = await authSupabase.auth.getUser();

    if (user) {
      const { data: userThreadLike } = await authSupabase
        .from('forum_likes')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('target_type', 'thread')
        .eq('target_id', thread.id)
        .maybeSingle();

      threadLiked = !!userThreadLike;

      if (replyIds.length > 0) {
        const { data: userReplyLikes } = await authSupabase
          .from('forum_likes')
          .select('target_id')
          .eq('user_id', user.id)
          .eq('target_type', 'reply')
          .in('target_id', replyIds);

        for (const like of userReplyLikes || []) {
          replyLikedIds.push(like.target_id);
        }
      }
    }

    return {
      id: thread.id,
      title: thread.title,
      content: cleanBody,
      author: resolveForumAuthor({
        isSystemThread: thread.is_system_thread,
        users: thread.users as UserJoin,
      }),
      isSystemThread: thread.is_system_thread,
      createdAt: formatForumDate(thread.created_at),
      likes: likes?.length || 0,
      threadLiked,
      relatedIssueId: thread.stortinget_issue_id,
      relatedIssueTitle,
      contextItems: mergeContextItems(thread.body, thread.context_items),
      replyLikedIds,
      replies: (replies || []).map((reply) => ({
        id: reply.id,
        author: resolveForumAuthor({ users: reply.users as UserJoin }),
        content: parseContextItemsFromBody(reply.body).cleanBody,
        createdAt: formatForumDate(reply.created_at),
        likes: replyLikeCounts[reply.id] || 0,
        isVerifiedPolitician: politicianUserIds.has(reply.author_user_id),
        isOfficialResponse: reply.is_official_response,
      })),
    };
  } catch (e) {
    console.error('Failed to fetch thread:', e);
    return null;
  }
}

export async function getIssueTitle(issueId: string): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  const supabase = getAnonSupabase();
  const { data } = await supabase
    .from('stortinget_issues')
    .select('title')
    .eq('id', issueId)
    .maybeSingle();

  return data?.title ?? null;
}

export async function getSuggestedIssues(limit = 6): Promise<{ id: string; title: string }[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }

  const supabase = getAnonSupabase();
  const { data } = await supabase
    .from('stortinget_issues')
    .select('id,title')
    .order('last_synced_at', { ascending: false })
    .limit(limit);

  return (data || [])
    .filter((row) => row.title)
    .map((row) => ({ id: row.id, title: row.title as string }));
}
