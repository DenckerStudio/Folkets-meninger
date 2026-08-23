/**
 * Fire-and-forget n8n webhook that drafts a system poll (reel) from a stortingssak.
 * Set N8N_SYSTEM_POLL_DRAFT_WEBHOOK_URL in the app environment.
 */
export function triggerSystemPollDraftWebhook(stortingetIssueId?: string): boolean {
  const url = process.env.N8N_SYSTEM_POLL_DRAFT_WEBHOOK_URL?.trim();
  if (!url) return false;

  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 5_000);

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      stortingetIssueId ? { stortinget_issue_id: stortingetIssueId } : {},
    ),
    signal: controller.signal,
  })
    .catch((err) => {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.warn('[n8n] System poll draft webhook failed:', err);
    })
    .finally(() => clearTimeout(abortTimer));

  return true;
}
