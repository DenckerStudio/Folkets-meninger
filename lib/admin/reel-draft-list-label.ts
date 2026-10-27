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

/**
 * Subtitle under «Utkast til vurdering».
 * `listShowsNewestFirst` should match `/api/admin/polls` (`listSystemPollDrafts`: created_at DESC).
 */
export function adminReelDraftWaitingDescription(
  shown: number,
  total: number | null | undefined,
  listShowsNewestFirst = true,
): string {
  if (shown <= 0) {
    return 'Ingen utkast venter. Generer fra en sak under, eller vent på automatisk kjøring.';
  }

  const safeShown = Math.floor(shown);
  const safeTotal =
    typeof total === 'number' && Number.isFinite(total) && total > 0 ? Math.floor(total) : safeShown;

  if (safeTotal > safeShown) {
    const viserClause = listShowsNewestFirst
      ? `(viser de ${safeShown} nyeste)`
      : `(viser ${safeShown})`;
    return `${safeTotal} utkast venter på publisering eller arkivering ${viserClause}.`;
  }

  return `${safeShown} utkast venter på publisering eller arkivering.`;
}
