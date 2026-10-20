/** Infer whether the underlying proposal was adopted from Stortingets kortvedtak. */
export function resolveSakProposalAdopted(kortvedtak: string | null | undefined): boolean | null {
  const text = kortvedtak?.trim();
  if (!text) return null;
  if (/ble\s+ikke\s+vedtatt/i.test(text)) return false;
  if (/ble\s+vedtatt/i.test(text)) return true;
  return null;
}

export function formatStortingetVoteringTall(
  stForPercent: number,
  stAgainstPercent: number,
): string {
  return `Voteringen: ${stForPercent} % For, ${stAgainstPercent} % Mot`;
}
