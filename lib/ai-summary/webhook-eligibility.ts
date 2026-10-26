/** Whether to order a missing-summary webhook after a lightweight existence read. */
export function shouldTriggerMissingSummaryWebhook(
  readError: unknown,
  existingRow: unknown,
): boolean {
  if (readError) {
    return false;
  }
  return !existingRow;
}
