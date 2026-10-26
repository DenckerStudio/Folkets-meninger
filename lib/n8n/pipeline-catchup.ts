import { isLegacyEmbeddingsRetryEnabled } from '@/lib/n8n/legacy-embeddings-retry';
import { listPendingLegacyEmbeddingIssueIds } from '@/lib/n8n/legacy-embedding-pending-issues';
import { getServiceSupabase } from '@/lib/supabase';
import { triggerDocumentEmbeddingsWebhook } from '@/lib/trigger-document-embeddings-webhook';

export type PipelineCatchupResult = {
  embeddings: boolean;
  health: boolean;
  embeddingsIssuesTriggered: number;
};

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export async function triggerPipelineCatchup(): Promise<PipelineCatchupResult> {
  const embeddingsUrl = process.env.N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL?.trim();
  const healthUrl = process.env.N8N_PIPELINE_HEALTH_WEBHOOK_URL?.trim();

  let embeddingsIssuesTriggered = 0;
  if (isLegacyEmbeddingsRetryEnabled() && embeddingsUrl && supabaseConfigured()) {
    const service = getServiceSupabase();
    const issueIds = await listPendingLegacyEmbeddingIssueIds(service);
    for (const issueId of issueIds) {
      triggerDocumentEmbeddingsWebhook(issueId);
      embeddingsIssuesTriggered += 1;
    }
  }

  if (healthUrl) {
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 5_000);
    void fetch(healthUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.warn('[n8n] Pipeline health webhook failed:', err);
      })
      .finally(() => clearTimeout(abortTimer));
  }

  return {
    embeddings: embeddingsIssuesTriggered > 0,
    health: Boolean(healthUrl),
    embeddingsIssuesTriggered,
  };
}
