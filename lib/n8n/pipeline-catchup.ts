import { triggerDocumentEmbeddingsWebhook } from '@/lib/trigger-document-embeddings-webhook';

export function triggerPipelineCatchup(): { embeddings: boolean; health: boolean } {
  const embeddingsUrl = process.env.N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL?.trim();
  const healthUrl = process.env.N8N_PIPELINE_HEALTH_WEBHOOK_URL?.trim();

  triggerDocumentEmbeddingsWebhook();

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
    embeddings: Boolean(embeddingsUrl),
    health: Boolean(healthUrl),
  };
}
