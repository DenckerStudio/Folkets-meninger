/** Period labels embedded mid-sentence or in parentheses (lower case first letter). */
export function weeklyPeriodLabelMidSentence(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLocaleLowerCase('nb') + trimmed.slice(1);
}
