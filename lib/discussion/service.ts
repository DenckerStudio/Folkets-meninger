import { resolvePublicAuthor } from '@/lib/identity/public-identity';
import { getAnonSupabase, getServiceSupabase } from '@/lib/supabase';
import {
  DISCUSSION_BODY_MAX,
  DISCUSSION_BODY_MIN,
  DISCUSSION_PAGE_SIZE_DEFAULT,
  DISCUSSION_PAGE_SIZE_MAX,
  type ContentReportCategory,
  type DiscussionPostRecord,
  type DiscussionPostsPage,
} from './types';

type PostRow = {
  id: string;
  body: string;
  created_at: string;
  author_user_id: string;
  users:
    | {
        first_name: string | null;
        last_name: string | null;
        name: string | null;
      }
    | {
        first_name: string | null;
        last_name: string | null;
        name: string | null;
      }[]
    | null;
};

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function mapPostRow(row: PostRow): DiscussionPostRecord {
  const author = resolvePublicAuthor({
    userId: row.author_user_id,
    users: row.users,
  });

  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    authorUserId: row.author_user_id,
    authorName: author?.name ?? null,
    authorInitials: author?.initials ?? '?',
  };
}

async function getDiscussionIdForIssue(issueId: string): Promise<string | null> {
  if (!supabaseConfigured()) return null;

  const supabase = getAnonSupabase();
  const { data } = await supabase
    .from('issue_discussions')
    .select('id')
    .eq('stortinget_issue_id', issueId)
    .maybeSingle();

  return data?.id ?? null;
}

export async function listDiscussionPosts(
  issueId: string,
  options?: { cursor?: string | null; limit?: number },
): Promise<DiscussionPostsPage> {
  if (!supabaseConfigured()) {
    return { posts: [], nextCursor: null };
  }

  const discussionId = await getDiscussionIdForIssue(issueId);
  if (!discussionId) {
    return { posts: [], nextCursor: null };
  }

  const limit = Math.min(
    Math.max(options?.limit ?? DISCUSSION_PAGE_SIZE_DEFAULT, 1),
    DISCUSSION_PAGE_SIZE_MAX,
  );

  const supabase = getAnonSupabase();
  let query = supabase
    .from('issue_discussion_posts')
    .select(
      `
      id,
      body,
      created_at,
      author_user_id,
      users:author_user_id (first_name, last_name, name)
    `,
    )
    .eq('discussion_id', discussionId)
    .eq('is_removed', false)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (options?.cursor) {
    query = query.lt('created_at', options.cursor);
  }

  const { data, error } = await query;
  if (error) {
    console.error('listDiscussionPosts error:', error.message);
    return { posts: [], nextCursor: null };
  }

  const rows = (data ?? []) as PostRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const posts = pageRows.map(mapPostRow);
  const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.created_at ?? null : null;

  return { posts, nextCursor };
}

export async function createDiscussionPost(
  userId: string,
  issueId: string,
  body: string,
): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Tjenesten er ikke konfigurert');
  }

  const trimmed = body.trim();
  if (trimmed.length < DISCUSSION_BODY_MIN || trimmed.length > DISCUSSION_BODY_MAX) {
    throw new Error(`Innlegget må være mellom ${DISCUSSION_BODY_MIN} og ${DISCUSSION_BODY_MAX} tegn`);
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('create_issue_discussion_post', {
    p_user_id: userId,
    p_issue_id: issueId,
    p_body: trimmed,
    p_parent_post_id: null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return String(data);
}

export async function reportDiscussionPost(
  reporterUserId: string,
  postId: string,
  category: ContentReportCategory,
  details?: string | null,
): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Tjenesten er ikke konfigurert');
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('report_content', {
    p_reporter_user_id: reporterUserId,
    p_target_type: 'issue_discussion_post',
    p_target_id: postId,
    p_category: category,
    p_details: details ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return String(data);
}

export async function discussionPostBelongsToIssue(
  postId: string,
  issueId: string,
): Promise<boolean> {
  if (!supabaseConfigured()) return false;

  const discussionId = await getDiscussionIdForIssue(issueId);
  if (!discussionId) return false;

  const supabase = getAnonSupabase();
  const { data } = await supabase
    .from('issue_discussion_posts')
    .select('id')
    .eq('id', postId)
    .eq('discussion_id', discussionId)
    .eq('is_removed', false)
    .maybeSingle();

  return Boolean(data);
}
