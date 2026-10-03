import { triggerN8nWebhook } from '@/lib/n8n/trigger-webhook';

/**
 * Fire-and-forget n8n webhook for embedding pending document chunks (batched queue).
 * Set N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL in the app environment.
 */
export function triggerDocumentEmbeddingsWebhook(stortingetIssueId?: string): void {
  triggerN8nWebhook({
    kind: 'document-embeddings',
    url: process.env.N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL,
    body: stortingetIssueId ? { stortinget_issue_id: stortingetIssueId } : {},
  });
}
