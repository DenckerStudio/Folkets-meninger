import { enqueueAiSummaryWebhook } from '@/lib/ai-summary/webhook-dispatch';

/**
 * Fire-and-forget n8n webhook when a stortingssak needs AI summary generation.
 * Set N8N_AI_SUMMARY_WEBHOOK_URL (and optionally N8N_AI_SUMMARY_WEBHOOK_TOKEN) in fm-web env
 * (see workflows/n8n/README.md).
 */
export function triggerAiSummaryWebhook(stortingetIssueId: string): void {
  enqueueAiSummaryWebhook(stortingetIssueId);
}
