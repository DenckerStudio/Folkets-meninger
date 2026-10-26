import { getServiceSupabase } from '@/lib/supabase';
import { triggerAiSummaryWebhook } from '@/lib/trigger-ai-summary-webhook';
import { isLegacyEmbeddingsRetryEnabled } from '@/lib/n8n/legacy-embeddings-retry';
import { listPendingLegacyEmbeddingIssueIds } from '@/lib/n8n/legacy-embedding-pending-issues';
import { triggerDocumentEmbeddingsWebhook } from '@/lib/trigger-document-embeddings-webhook';
import { triggerSystemPollDraftWebhook } from '@/lib/trigger-system-poll-draft-webhook';

const AI_SUMMARY_COOLDOWN_MS = 60 * 60 * 1000;
const AI_SUMMARY_PENDING_SCAN_LIMIT = 200;
const AI_SUMMARY_QUEUE_PER_RUN = 3;

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
  const cutoffMs = Date.now() - AI_SUMMARY_COOLDOWN_MS;

  const { data: pendingIssues, error: issueError } = await service
    .from('stortinget_issues')
    .select('id, ai_summary_requested_at')
    .eq('status', 'pending')
    .order('ai_summary_requested_at', { ascending: true, nullsFirst: true })
    .order('last_synced_at', { ascending: true })
    .limit(AI_SUMMARY_PENDING_SCAN_LIMIT);

  if (issueError) {
    console.warn('[n8n-retry] Could not list pending issues:', issueError.message);
  }

  const candidateIds = (pendingIssues ?? [])
    .map((issue) => (typeof issue?.id === 'string' ? issue.id : null))
    .filter((id): id is string => Boolean(id));

  let haveSummary = new Set<string>();
  if (candidateIds.length > 0) {
    const { data: summaryRows, error: summaryError } = await service
      .from('issue_ai_summaries')
      .select('stortinget_issue_id')
      .in('stortinget_issue_id', candidateIds);

    if (summaryError) {
      console.warn('[n8n-retry] Could not list AI summaries for candidates:', summaryError.message);
    } else {
      haveSummary = new Set(
        (summaryRows ?? [])
          .map((row) =>
            typeof row.stortinget_issue_id === 'string' ? row.stortinget_issue_id : null,
          )
          .filter((id): id is string => Boolean(id)),
      );
    }
  }

  for (const issue of pendingIssues ?? []) {
    if (result.aiSummariesQueued >= AI_SUMMARY_QUEUE_PER_RUN) break;
    if (!issue?.id || haveSummary.has(issue.id)) continue;
    const requestedMs =
      typeof issue.ai_summary_requested_at === 'string'
        ? Date.parse(issue.ai_summary_requested_at)
        : Number.NaN;
    if (Number.isFinite(requestedMs) && requestedMs >= cutoffMs) continue;

    const requestedNow = new Date().toISOString();
    const { error: markError } = await service
      .from('stortinget_issues')
      .update({ ai_summary_requested_at: requestedNow })
      .eq('id', issue.id);

    if (markError) {
      console.warn(
        `[n8n-retry] Could not mark ai_summary_requested_at for ${issue.id}:`,
        markError.message,
      );
      continue;
    }

    triggerAiSummaryWebhook(issue.id);
    result.aiSummariesQueued += 1;
  }

  if (isLegacyEmbeddingsRetryEnabled()) {
    const issueIds = await listPendingLegacyEmbeddingIssueIds(service, 50);
    result.embeddingsPendingIssues = issueIds.length;
    const firstIssueId = issueIds[0];
    if (firstIssueId) {
      result.embeddingsQueued = true;
      triggerDocumentEmbeddingsWebhook(firstIssueId);
    }
  }

  result.systemPollQueued = triggerSystemPollDraftWebhook();
  return result;
}
