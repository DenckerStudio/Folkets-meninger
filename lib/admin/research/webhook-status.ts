import { getResearchWebhookConfig } from '@/lib/admin/research/webhook';

export function isResearchWebhookConfigured(): boolean {
  return getResearchWebhookConfig() !== null;
}
