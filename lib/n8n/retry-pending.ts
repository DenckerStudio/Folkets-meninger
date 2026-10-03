import { getServiceSupabase } from '@/lib/supabase';
import { triggerAiSummaryWebhook } from '@/lib/trigger-ai-summary-webhook';
import { triggerDocumentEmbeddingsWebhook } from '@/lib/trigger-document-embeddings-webhook';
import { triggerSystemPollDraftWebhook } from '@/lib/trigger-system-poll-draft-webhook';

const AI_SUMMARY_COOLDOWN_MS = 60 * 60 * 1000;

export type N8nRetryResult = {
  aiSummariesQueued: number;
  embeddingsQueued: boolean;
  systemPollQueued: boolean;
  embeddingsPendingIssues: number;
};

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

/**
 * Re-triggers n8n work that is still pending in the DB.
 * Does not generate summaries/embeddings/reels in-app — only the existing webhook path.
 * List queries never select detail_json.
 */
export async function retryPendingN8nJobs(): Promise<N8nRetryResult> {
  const result: N8nRetryResult = {
    aiSummariesQueued: 0,
    embeddingsQueued: false,
    systemPollQueued: false,
    embeddingsPendingIssues: 0,
  };

  if (!supabaseConfigured()) {
    console.warn('[n8n-retry] Supabase is not configured; skipping queue scan');
    result.systemPollQueued = triggerSystemPollDraftWebhook();
    return result;
  }

  const service = getServiceSupabase();
  const cutoff = new Date(Date.now() - AI_SUMMARY_COOLDOWN_MS).toISOString();

  const [{ data: summaryRows, error: summaryError }, { data: pendingIssues, error: issueError }] =
    await Promise.all([
      service.from('issue_ai_summaries').select('stortinget_issue_id'),
      service
        .from('stortinget_issues')
        .select('id, ai_summary_requested_at')
        .eq('status', 'pending')
        .order('last_synced_at', { ascending: false })
        .limit(40),
    ]);

  if (summaryError) {
    console.warn('[n8n-retry] Could not list AI summaries:', summaryError.message);
  }
  if (issueError) {
    console.warn('[n8n-retry] Could not list pending issues:', issueError.message);
  }

  const haveSummary = new Set(
    (summaryRows ?? [])
      .map((row) => (typeof row.stortinget_issue_id === 'string' ? row.stortinget_issue_id : null))
      .filter((id): id is string => Boolean(id)),
  );

  for (const issue of pendingIssues ?? []) {
    if (result.aiSummariesQueued >= 3) break;
    if (!issue?.id || haveSummary.has(issue.id)) continue;
    const requestedAt =
      typeof issue.ai_summary_requested_at === 'string' ? issue.ai_summary_requested_at : null;
    if (requestedAt && requestedAt >= cutoff) continue;
    triggerAiSummaryWebhook(issue.id);
    result.aiSummariesQueued += 1;
  }

  const { data: pendingChunks, error: chunkError } = await service
    .from('document_chunks')
    .select('issue_id')
    .eq('embedding_status', 'pending')
    .limit(20);

  if (chunkError) {
    console.warn('[n8n-retry] Could not list pending chunks:', chunkError.message);
  } else {
    const issueIds = new Set(
      (pendingChunks ?? [])
        .map((row) => (typeof row.issue_id === 'string' ? row.issue_id : null))
        .filter((id): id is string => Boolean(id)),
    );
    result.embeddingsPendingIssues = issueIds.size;
    if (issueIds.size > 0) {
      const firstIssueId = issueIds.values().next().value;
      result.embeddingsQueued = true;
      triggerDocumentEmbeddingsWebhook(firstIssueId);
    }
  }

  result.systemPollQueued = triggerSystemPollDraftWebhook();
  return result;
}
