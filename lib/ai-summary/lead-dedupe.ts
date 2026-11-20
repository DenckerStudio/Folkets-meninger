function normalizeLead(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * «Kort fortalt» og sammendragsraden på saksiden leses fra samme rad. Når teksten allerede står
 * i «Kort fortalt», skal den ikke gjentas under AI-merkingen.
 */
export function isSummaryLeadAlreadyShown(
  lead: string | null | undefined,
  shownAbove: string | null | undefined,
): boolean {
  const normalizedLead = normalizeLead(lead ?? '');
  if (!normalizedLead) return false;
  const normalizedAbove = normalizeLead(shownAbove ?? '');
  if (!normalizedAbove) return false;
  return normalizedAbove.includes(normalizedLead);
}
