export type SakTreatmentStatus = 'pending' | 'closed';

export type ListSakInnstillingFields = {
  innstilling_id?: number;
  innstilling_kode?: number;
};

type SakDetailStatusFields = {
  ferdigbehandlet?: boolean | null;
  status?: number | null;
};

/**
 * Stortinget status codes (verified against detail exports):
 *   1 = ferdigbehandlet (closed)
 *   2 and 3 = under behandling (pending)
 *
 * `ferdigbehandlet` is the most reliable source. A fresh numeric list status is
 * preferred over the cached DB string because list/detail exports can drift.
 */
export function resolveSakListStatus(input: {
  ferdigbehandlet?: boolean | null;
  numericStatus?: number | null;
  cachedStatus?: string | null;
}): SakTreatmentStatus {
  if (input.ferdigbehandlet === true) return 'closed';
  if (input.ferdigbehandlet === false) return 'pending';
  if (input.numericStatus != null) return input.numericStatus === 1 ? 'closed' : 'pending';
  if (input.cachedStatus === 'closed') return 'closed';
  if (input.cachedStatus === 'pending') return 'pending';
  return 'pending';
}

/** Prefer cached detail / DB column over list-export heuristics. */
export function resolveSakStatusFromSources(input: {
  ferdigbehandlet?: boolean | null;
  detailJson?: SakDetailStatusFields | null;
  cachedStatus?: string | null;
  /** Fresh list-export status code; wins over stale detail_json.status when both are set. */
  numericStatus?: number | null;
  listInnstilling?: ListSakInnstillingFields | null;
}): SakTreatmentStatus {
  const detailFerdigbehandlet =
    typeof input.detailJson?.ferdigbehandlet === 'boolean' ? input.detailJson.ferdigbehandlet : null;
  const effectiveFerdigbehandlet =
    typeof detailFerdigbehandlet === 'boolean'
      ? detailFerdigbehandlet
      : typeof input.ferdigbehandlet === 'boolean'
        ? input.ferdigbehandlet
        : null;
  const numericStatus =
    input.numericStatus ??
    (typeof input.detailJson?.status === 'number' ? input.detailJson.status : null);

  return resolveSakListStatus({
    ferdigbehandlet: effectiveFerdigbehandlet,
    numericStatus,
    cachedStatus: input.cachedStatus,
  });
}

/** @deprecated Use resolveSakListStatus */
export function resolveSakTreatmentStatus(input: {
  ferdigbehandlet?: boolean | null;
  numericStatus?: number | null;
  cachedStatus?: string | null;
}): SakTreatmentStatus {
  return resolveSakListStatus(input);
}

export function getSakTreatmentLabel(status: SakTreatmentStatus): string {
  return status === 'closed' ? 'Ferdigbehandlet' : 'Under behandling';
}

export function getSakTreatmentTooltipKey(
  status: SakTreatmentStatus,
): 'ferdigbehandlet' | 'underBehandling' {
  return status === 'closed' ? 'ferdigbehandlet' : 'underBehandling';
}

export function getSakTreatmentBadgeClassName(status: SakTreatmentStatus): string {
  return status === 'closed'
    ? 'bg-muted text-muted-foreground'
    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
}

export const SAK_KIND_BADGE_CLASS =
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200';

export const SAK_CATEGORY_BADGE_CLASS =
  'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200';

export const SAK_TYPE_BADGE_CLASS =
  'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200';
