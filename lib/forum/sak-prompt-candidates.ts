import { getServiceSupabase } from '@/lib/supabase';

export type SakPromptCandidate = {
  issueId: string;
  title: string;
  category: string | null;
  ragChunkCount: number;
  hasAiSummary: boolean;
  firstSeenAt: string | null;
  lastUpdatedAt: string | null;
  hasDraftOrActivePrompt: boolean;
};

export type SakPromptCoverage = {
  pendingIssues: number;
  pendingWithRag: number;
  sakCandidates: number;
  pendingWithPrompt: number;
};

const CANDIDATE_LIMIT = 25;

export async function getSakPromptCoverage(): Promise<SakPromptCoverage> {
  const service = getServiceSupabase();
  const { data, error } = await service.rpc('get_sak_prompt_coverage' as never);

  if (error || !data) {
    const { data: rows } = await service.from('stortinget_issues').select('id, status');
    const pending = (rows ?? []).filter((r) => r.status === 'pending');
    return {
      pendingIssues: pending.length,
      pendingWithRag: 0,
      sakCandidates: 0,
      pendingWithPrompt: 0,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    pendingIssues: Number(row.pending_issues ?? 0),
    pendingWithRag: Number(row.pending_with_rag ?? 0),
    sakCandidates: Number(row.sak_candidates ?? 0),
    pendingWithPrompt: Number(row.pending_with_prompt ?? 0),
  };
}

export function filterSakPromptCandidates(
  issues: Array<{
    id: string;
    title: string;
    category: string | null;
    first_seen_at: string | null;
    last_updated_at: string | null;
  }>,
  ragCountByIssue: Map<string, number>,
  summarySet: Set<string>,
  promptSet: Set<string>,
  limit = CANDIDATE_LIMIT,
): SakPromptCandidate[] {
  return issues
    .map((issue) => {
      const ragChunkCount = ragCountByIssue.get(issue.id) ?? 0;
      return {
        issueId: issue.id,
        title: issue.title,
        category: issue.category,
        ragChunkCount,
        hasAiSummary: summarySet.has(issue.id),
        firstSeenAt: issue.first_seen_at,
        lastUpdatedAt: issue.last_updated_at,
        hasDraftOrActivePrompt: promptSet.has(issue.id),
      };
    })
    .filter((c) => c.ragChunkCount > 0 && !c.hasDraftOrActivePrompt)
    .slice(0, limit);
}

export async function listSakPromptCandidates(limit = CANDIDATE_LIMIT): Promise<SakPromptCandidate[]> {
  const service = getServiceSupabase();

  const { data: issues, error } = await service
    .from('stortinget_issues')
    .select('id, title, category, status, first_seen_at, last_updated_at')
    .eq('status', 'pending')
    .order('last_updated_at', { ascending: false, nullsFirst: false })
    .limit(80);

  if (error || !issues?.length) return [];

  const issueIds = issues.map((i) => i.id);

  const [{ data: chunks }, { data: summaries }, { data: prompts }] = await Promise.all([
    service
      .from('document_chunks')
      .select('issue_id')
      .in('issue_id', issueIds)
      .eq('embedding_status', 'ready'),
    service.from('issue_ai_summaries').select('stortinget_issue_id').in('stortinget_issue_id', issueIds),
    service
      .from('forum_prompts')
      .select('stortinget_issue_id, status')
      .in('stortinget_issue_id', issueIds)
      .in('status', ['active', 'draft']),
  ]);

  const ragCountByIssue = new Map<string, number>();
  for (const row of chunks ?? []) {
    const id = row.issue_id as string;
    ragCountByIssue.set(id, (ragCountByIssue.get(id) ?? 0) + 1);
  }

  const summarySet = new Set((summaries ?? []).map((s) => s.stortinget_issue_id as string));
  const promptSet = new Set((prompts ?? []).map((p) => p.stortinget_issue_id as string));

  return filterSakPromptCandidates(issues, ragCountByIssue, summarySet, promptSet, limit);
}
