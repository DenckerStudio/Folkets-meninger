import { getAnonSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';
import { parsePromptSources, type PromptSourceHeadline } from '@/lib/forum/prompt-source';

export type PromptOption = {
  id: string;
  label: string;
  count?: number;
  percent?: number;
};

export type PromptResults = {
  total?: number;
  options?: PromptOption[];
  discuss_click_count?: number;
  discuss_threshold?: number;
  spawned_thread_id?: string | null;
};

const PROMPT_RESULTS_CACHE_TTL_MS = 5 * 60 * 1000;
const promptResultsCache = new Map<string, { data: PromptResults; expiresAt: number }>();

async function getPromptResultsCached(
  supabase: ReturnType<typeof getAnonSupabase>,
  promptId: string,
): Promise<PromptResults> {
  const cached = promptResultsCache.get(promptId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const { data: resultData } = await supabase.rpc('get_prompt_results', {
    p_prompt_id: promptId,
  });

  const parsed = (resultData || {}) as PromptResults;
  promptResultsCache.set(promptId, {
    data: parsed,
    expiresAt: Date.now() + PROMPT_RESULTS_CACHE_TTL_MS,
  });

  return parsed;
}

export type ForumPrompt = {
  id: string;
  question: string;
  options: PromptOption[];
  topicTags: string[];
  sources: PromptSourceHeadline[];
  stortingetIssueId: string | null;
  discussClickCount: number;
  discussThreshold: number;
  spawnedThreadId: string | null;
  userVote: string | null;
  userDiscussClicked: boolean;
};

export async function getActiveForumPrompts(limit = 18): Promise<ForumPrompt[]> {
  const page = await getActiveForumPromptsPage({ limit });
  return page.items;
}

export type ActiveForumPromptsPage = {
  items: ForumPrompt[];
  nextCursor: string | null;
};

export async function getActiveForumPromptsPage({
  limit = 18,
  cursor,
}: {
  limit?: number;
  cursor?: string;
}): Promise<ActiveForumPromptsPage> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { items: [], nextCursor: null };
  }

  const supabase = getAnonSupabase();
  let query = supabase
    .from('forum_prompts')
    .select('id, question, options, topic_tags, source_headlines, stortinget_issue_id, discuss_click_count, discuss_threshold, spawned_thread_id, created_at')
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    const createdAt = cursor.split('|')[0] ?? '';
    const id = cursor.split('|')[1] ?? '';
    if (createdAt && id) {
      query = query.or(
        `and(created_at.lt.${createdAt}),and(created_at.eq.${createdAt},id.lt.${id})`,
      );
    }
  }

  const { data: prompts, error } = await query;

  if (error || !prompts?.length) return { items: [], nextCursor: null };

  const authSupabase = await getServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();

  const promptIds = prompts.map((p) => p.id);
  let votesByPrompt: Record<string, string> = {};
  let discussByPrompt = new Set<string>();

  if (user) {
    const { data: votes } = await authSupabase
      .from('forum_prompt_votes')
      .select('prompt_id, option_id')
      .eq('user_id', user.id)
      .in('prompt_id', promptIds);

    for (const v of votes || []) {
      votesByPrompt[v.prompt_id] = v.option_id;
    }

    const { data: clicks } = await authSupabase
      .from('forum_prompt_discuss_clicks')
      .select('prompt_id')
      .eq('user_id', user.id)
      .in('prompt_id', promptIds);

    discussByPrompt = new Set((clicks || []).map((c) => c.prompt_id));
  }

  const results = await Promise.all(
    prompts.slice(0, limit).map(async (prompt) => {
      const parsed = await getPromptResultsCached(supabase, prompt.id);

      const rawOptions = Array.isArray(prompt.options) ? prompt.options : [];
      const resultOptions = parsed.options || [];

      return {
        id: prompt.id,
        question: prompt.question,
        options: rawOptions.map((opt: { id: string; label: string }) => {
          const match = resultOptions.find((r) => r.id === opt.id);
          return {
            id: opt.id,
            label: opt.label,
            count: match?.count ?? 0,
            percent: match?.percent ?? 0,
          };
        }),
        topicTags: prompt.topic_tags || [],
        sources: parsePromptSources(prompt.source_headlines),
        stortingetIssueId: prompt.stortinget_issue_id ?? null,
        discussClickCount: parsed.discuss_click_count ?? prompt.discuss_click_count ?? 0,
        discussThreshold: parsed.discuss_threshold ?? prompt.discuss_threshold ?? 10,
        spawnedThreadId: parsed.spawned_thread_id ?? prompt.spawned_thread_id,
        userVote: votesByPrompt[prompt.id] ?? null,
        userDiscussClicked: discussByPrompt.has(prompt.id),
      };
    })
  );

  const hasMore = prompts.length > limit;
  const last = prompts[Math.min(limit - 1, prompts.length - 1)] as { created_at?: string; id: string } | undefined;
  const nextCursor = hasMore && last?.created_at ? `${last.created_at}|${last.id}` : null;

  return { items: results, nextCursor };
}

export async function getDraftForumPrompts() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  const { getServiceSupabase } = await import('@/lib/supabase');
  const service = getServiceSupabase();
  const { data } = await service
    .from('forum_prompts')
    .select('*')
    .eq('status', 'draft')
    .order('created_at', { ascending: false });

  return data || [];
}
