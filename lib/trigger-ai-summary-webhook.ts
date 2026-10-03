import { triggerN8nWebhook } from '@/lib/n8n/trigger-webhook';

/**
 * Fire-and-forget n8n webhook when a stortingssak needs AI summary generation.
 * Set N8N_AI_SUMMARY_WEBHOOK_URL in the app environment (see workflows/n8n/README.md).
 */
export function triggerAiSummaryWebhook(stortingetIssueId: string): void {
  triggerN8nWebhook({
    kind: 'ai-summary',
    url: process.env.N8N_AI_SUMMARY_WEBHOOK_URL,
    body: { stortinget_issue_id: stortingetIssueId },
  });
}
