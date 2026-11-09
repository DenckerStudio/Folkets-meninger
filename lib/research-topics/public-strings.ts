/** Client-safe public copy rules for research topics (never name Reddit). */

export function validateResearchTopicPublicString(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('reddit')) {
    return 'Teksten kan ikke nevne Reddit';
  }
  return null;
}

export function assertResearchTopicPublicStrings(values: string[]): string | null {
  for (const value of values) {
    const err = validateResearchTopicPublicString(value);
    if (err) return err;
  }
  return null;
}
