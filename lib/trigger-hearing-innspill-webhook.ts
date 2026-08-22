/**
 * Fire-and-forget n8n webhook when a motforslag is packaged for a hearing.
 * Set N8N_HEARING_INNSPILL_WEBHOOK_URL (see workflows/n8n/README.md).
 * This does not submit to Stortinget — n8n emails/stores the report.
 */
export function triggerHearingInnspillWebhook(payload: unknown): boolean {
  const url = process.env.N8N_HEARING_INNSPILL_WEBHOOK_URL?.trim();
  if (!url) return false;

  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 5_000);

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .catch((err) => {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.warn('[n8n] Hearing innspill webhook failed:', err);
    })
    .finally(() => clearTimeout(abortTimer));

  return true;
}
