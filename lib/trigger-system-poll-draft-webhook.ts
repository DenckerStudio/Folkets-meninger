import { triggerN8nWebhook } from '@/lib/n8n/trigger-webhook';

/**
 * Fire-and-forget n8n webhook that drafts a system poll (reel) from a stortingssak.
 * Set N8N_SYSTEM_POLL_DRAFT_WEBHOOK_URL in the app environment.
 */
export function triggerSystemPollDraftWebhook(stortingetIssueId?: string): boolean {
  return triggerN8nWebhook({
    kind: 'system-poll-draft',
    url: process.env.N8N_SYSTEM_POLL_DRAFT_WEBHOOK_URL,
    body: stortingetIssueId ? { stortinget_issue_id: stortingetIssueId } : {},
  });
}
