import { postN8nWebhook } from '@/lib/n8n/trigger-webhook';

export const PIPELINE_EMBEDDING_CATCHUP_CONCURRENCY = 4;

export type PipelineCatchupResult = {
  /** Document-embeddings webhook URL is set (ingest path); admin catch-up does not sweep pending v1 chunks. */
  embeddingsConfigured: boolean;
  /** Always false — legacy nomic backfill sweep removed; use ingest webhooks per sak. */
  embeddings: boolean;
  health: boolean;
  embeddingsIssuesTriggered: number;
};

export function isEmbeddingsCatchupConfigured(): boolean {
  return Boolean(process.env.N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL?.trim());
}

async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  let nextIndex = 0;
  const poolSize = Math.min(limit, items.length);
  const runners = Array.from({ length: poolSize }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

export type EmbeddingCatchupDeps = {
  postWebhook?: typeof postN8nWebhook;
};

/** Fire legacy per-sak document-embeddings webhooks with a bounded concurrency pool. */
export async function runEmbeddingCatchupWebhooks(
  issueIds: readonly string[],
  deps: EmbeddingCatchupDeps = {},
): Promise<void> {
  const embeddingsUrl = process.env.N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL?.trim();
  if (!embeddingsUrl || issueIds.length === 0) {
    return;
  }

  const postWebhook = deps.postWebhook ?? postN8nWebhook;

  await runWithConcurrency(
    issueIds,
    PIPELINE_EMBEDDING_CATCHUP_CONCURRENCY,
    async (issueId) => {
      await postWebhook(
        embeddingsUrl,
        { stortinget_issue_id: issueId },
        'document-embeddings',
      );
    },
  );
}

export async function preparePipelineCatchup(): Promise<{
  result: PipelineCatchupResult;
  embeddingIssueIds: string[];
}> {
  const embeddingsConfigured = isEmbeddingsCatchupConfigured();
  const healthUrl = process.env.N8N_PIPELINE_HEALTH_WEBHOOK_URL?.trim();

  const embeddingIssueIds: string[] = [];

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

  const embeddingsIssuesTriggered = embeddingIssueIds.length;

  return {
    embeddingIssueIds,
    result: {
      embeddingsConfigured,
      embeddings: embeddingsIssuesTriggered > 0,
      health: Boolean(healthUrl),
      embeddingsIssuesTriggered,
    },
  };
}

/** @deprecated Prefer preparePipelineCatchup + runEmbeddingCatchupWebhooks (admin route uses after()). */
export async function triggerPipelineCatchup(): Promise<PipelineCatchupResult> {
  const { result, embeddingIssueIds } = await preparePipelineCatchup();
  await runEmbeddingCatchupWebhooks(embeddingIssueIds);
  return result;
}

