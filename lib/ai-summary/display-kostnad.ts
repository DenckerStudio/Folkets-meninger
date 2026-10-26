/** Hide n8n placeholder cost copy from the UI tile. */
export function isDisplayableAiSummaryKostnad(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower === 'ikke omtalt') return false;
  if (lower.startsWith('ikke omtalt i kilden')) return false;
  return true;
}
