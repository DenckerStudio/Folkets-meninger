/** Admin reels: list is capped (e.g. 50) while pipeline-health reports the full draft count. */
export function adminReelDraftListLabel(shown: number, total: number | null | undefined): string {
  const safeShown = Number.isFinite(shown) && shown > 0 ? Math.floor(shown) : 0;
  const safeTotal =
    typeof total === 'number' && Number.isFinite(total) && total > 0 ? Math.floor(total) : safeShown;

  if (safeShown > 0 && safeTotal > safeShown) {
    return `Viser ${safeShown} av ${safeTotal}`;
  }
  if (safeShown > 0) {
    return String(safeShown);
  }
  return '0';
}

export function adminReelDraftWaitingDescription(
  shown: number,
  total: number | null | undefined,
): string {
  if (shown <= 0) {
    return 'Ingen utkast venter. Generer fra en sak under, eller vent på automatisk kjøring.';
  }
  const label = adminReelDraftListLabel(shown, total);
  if (typeof total === 'number' && total > shown) {
    return `${label} utkast venter på publisering eller arkivering.`;
  }
  return `${shown} utkast venter på publisering eller arkivering.`;
}
