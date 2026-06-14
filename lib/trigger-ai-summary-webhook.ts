/**
 * Fire-and-forget n8n webhook when a stortingssak needs AI summary generation.
 * Set N8N_AI_SUMMARY_WEBHOOK_URL in the app environment (see workflows/n8n/README.md).
 */
export function triggerAiSummaryWebhook(stortingetIssueId: string): void {
  const url = process.env.N8N_AI_SUMMARY_WEBHOOK_URL?.trim();
  if (!url) return;

  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 5_000);

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stortinget_issue_id: stortingetIssueId }),
    signal: controller.signal,
  })
    .catch((err) => {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.warn('[n8n] AI summary webhook failed:', err);
    })
    .finally(() => clearTimeout(abortTimer));
}
