/** How a generated draft should be merged into the comment field. */
export type HearingInnspillDraftMerge = 'replace' | 'append';

export function applyHearingInnspillDraftToBody(
  existingBody: string,
  draft: string,
  merge: HearingInnspillDraftMerge,
): string {
  const draftText = draft.trim();
  if (!draftText) return existingBody;
  const existing = existingBody.trim();
  if (!existing) return draftText;
  if (merge === 'replace') return draftText;
  return `${existing}\n\n${draftText}`;
}

export function hearingInnspillDraftNeedsConfirm(existingBody: string): boolean {
  return existingBody.trim().length > 0;
}