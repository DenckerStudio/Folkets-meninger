/**
 * Systemgenererte Reels-avstemninger er avviklet (2026). Beholdes som no-op så
 * eldre kall ikke starter n8n-workflowen ved en feil.
 */
export function triggerSystemPollDraftWebhook(_stortingetIssueId?: string): boolean {
  return false;
}
