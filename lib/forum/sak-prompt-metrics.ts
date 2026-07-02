import { getServiceSupabase } from '@/lib/supabase';

export type SakPromptMetrics = {
  draftSakPrompts: number;
  activeSakPrompts: number;
  publishedLast7Days: number;
  avgRagChunksPerDraft: number;
};

export async function getSakPromptMetrics(): Promise<SakPromptMetrics> {
  const service = getServiceSupabase();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: prompts } = await service
    .from('forum_prompts')
    .select('status, created_at, generation_metadata, stortinget_issue_id')
    .not('stortinget_issue_id', 'is', null);

  const rows = prompts ?? [];
  const sakRows = rows.filter((r) => r.stortinget_issue_id);
  const draftRows = sakRows.filter((r) => r.status === 'draft');
  const activeRows = sakRows.filter((r) => r.status === 'active');
  const recentPublished = activeRows.filter((r) => r.created_at >= since);

  let ragTotal = 0;
  let ragCount = 0;
  for (const row of draftRows) {
    const meta = row.generation_metadata as { rag_chunk_count?: number } | null;
    if (typeof meta?.rag_chunk_count === 'number') {
      ragTotal += meta.rag_chunk_count;
      ragCount += 1;
    }
  }

  return {
    draftSakPrompts: draftRows.length,
    activeSakPrompts: activeRows.length,
    publishedLast7Days: recentPublished.length,
    avgRagChunksPerDraft: ragCount > 0 ? Math.round((ragTotal / ragCount) * 10) / 10 : 0,
  };
}
