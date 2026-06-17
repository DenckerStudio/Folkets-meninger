/**
 * Fire-and-forget n8n webhook for embedding pending document chunks (batched queue).
 * Set N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL in the app environment.
 */
export function triggerDocumentEmbeddingsWebhook(stortingetIssueId?: string): void {
  const url = process.env.N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL?.trim();
  if (!url) return;

  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 5_000);

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      stortingetIssueId ? { stortinget_issue_id: stortingetIssueId } : {}
    ),
    signal: controller.signal,
  })
    .catch((err) => {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.warn('[n8n] Document embeddings webhook failed:', err);
    })
    .finally(() => clearTimeout(abortTimer));
}
