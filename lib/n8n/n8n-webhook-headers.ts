/** Shared JSON webhook headers for fm-web → n8n (never log token values). */
export function buildN8nWebhookHeaders(webhookToken?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = webhookToken?.trim();
  if (token) {
    headers['X-FM-Webhook-Token'] = token;
  }
  return headers;
}
