/**
 * Fire-and-forget n8n webhook for Stortinget-sak RAG prompt generation.
 * Set N8N_FORUM_SAK_PROMPTS_WEBHOOK_URL in the app environment.
 */
export function triggerForumSakPromptWebhook(stortingetIssueId?: string): void {
  const url = process.env.N8N_FORUM_SAK_PROMPTS_WEBHOOK_URL?.trim();
  if (!url) return;

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
      console.warn('[n8n] Forum sak prompt webhook failed:', err);
    })
    .finally(() => clearTimeout(abortTimer));
}
