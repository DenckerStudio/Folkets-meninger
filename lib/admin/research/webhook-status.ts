import { getResearchWebhookConfig } from '@/lib/admin/research/webhook';
import { getMissingResearchWebhookEnvKeys } from '@/lib/admin/research/webhook-errors';

export function isResearchWebhookConfigured(): boolean {
  return getResearchWebhookConfig() !== null;
}

export { getMissingResearchWebhookEnvKeys };
