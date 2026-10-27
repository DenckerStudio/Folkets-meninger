import { claimAiSummaryWebhook, deleteAiSummary } from '@/lib/ai-summary/service';
import { getServiceSupabase } from '@/lib/supabase';
import { triggerAiSummaryWebhook } from '@/lib/trigger-ai-summary-webhook';
import { triggerSystemPollDraftWebhook } from '@/lib/trigger-system-poll-draft-webhook';

const AI_SUMMARY_COOLDOWN_MS = 60 * 60 * 1000;
const AI_SUMMARY_PENDING_SCAN_LIMIT = 200;
const AI_SUMMARY_QUEUE_PER_RUN = 3;
const AI_SUMMARY_REGEN_SCAN_LIMIT = 50;

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

function isWebhookRetryEligible(requestedAt: string | null | undefined, cutoffMs: number): boolean {
  if (requestedAt == null) return true;
  const requestedMs = Date.parse(requestedAt);
  return !Number.isFinite(requestedMs) || requestedMs < cutoffMs;
}

/**
 * Re-triggers n8n work that is still pending in the DB.
 * Does not generate summaries/embeddings/reels in-app — only the existing webhook path.
 * List queries never select detail_json.
 *
 * Regenerering (regeneration_requested_at): sletter eksisterende sammendrag som admin force,
 * deretter claim + webhook. Flagget nullstilles ved vellykket n8n_upsert_issue_ai_summary,
 * ikke ved claim (tryggere ved feilende webhook).
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
    if (!isWebhookRetryEligible(issue.ai_summary_requested_at, cutoffMs)) continue;

    if (!(await claimAiSummaryWebhook(issue.id))) {
      continue;
    }

    triggerAiSummaryWebhook(issue.id);
    result.aiSummariesQueued += 1;
  }

  if (result.aiSummariesQueued < AI_SUMMARY_QUEUE_PER_RUN) {
    const { data: regenRows, error: regenError } = await service
      .from('issue_ai_summaries')
      .select('stortinget_issue_id, regeneration_requested_at')
      .not('regeneration_requested_at', 'is', null)
      .order('regeneration_requested_at', { ascending: true })
      .limit(AI_SUMMARY_REGEN_SCAN_LIMIT);

    if (regenError) {
      console.warn('[n8n-retry] Could not list regeneration queue:', regenError.message);
    } else {
      const regenIds = (regenRows ?? [])
        .map((row) =>
          typeof row.stortinget_issue_id === 'string' ? row.stortinget_issue_id : null,
        )
        .filter((id): id is string => Boolean(id));

      let issueRequestedAt = new Map<string, string | null>();
      if (regenIds.length > 0) {
        const { data: issueRows, error: regenIssueError } = await service
          .from('stortinget_issues')
          .select('id, ai_summary_requested_at')
          .in('id', regenIds);

        if (regenIssueError) {
          console.warn('[n8n-retry] Could not load issues for regeneration:', regenIssueError.message);
        } else {
          issueRequestedAt = new Map(
            (issueRows ?? []).map((row) => [
              String(row.id),
              typeof row.ai_summary_requested_at === 'string' ? row.ai_summary_requested_at : null,
            ]),
          );
        }
      }

      for (const row of regenRows ?? []) {
        if (result.aiSummariesQueued >= AI_SUMMARY_QUEUE_PER_RUN) break;
        const issueId =
          typeof row.stortinget_issue_id === 'string' ? row.stortinget_issue_id : null;
        if (!issueId) continue;

        const requestedAt = issueRequestedAt.get(issueId) ?? null;
        if (!isWebhookRetryEligible(requestedAt, cutoffMs)) continue;

        await deleteAiSummary(issueId);
        if (!(await claimAiSummaryWebhook(issueId))) {
          continue;
        }

        triggerAiSummaryWebhook(issueId);
        result.aiSummariesQueued += 1;
      }
    }
  }

  result.systemPollQueued = triggerSystemPollDraftWebhook();
  return result;
}
