import { triggerN8nWebhook } from '@/lib/n8n/trigger-webhook';

/**
 * Fire-and-forget n8n webhook when a motforslag is packaged for a hearing.
 * Set N8N_HEARING_INNSPILL_WEBHOOK_URL (see workflows/n8n/README.md).
 * This does not submit to Stortinget — n8n emails/stores the report.
 */
export function triggerHearingInnspillWebhook(payload: unknown): boolean {
  return triggerN8nWebhook({
    kind: 'hearing-innspill',
    url: process.env.N8N_HEARING_INNSPILL_WEBHOOK_URL,
    body: payload,
  });
}
