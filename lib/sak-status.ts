export type SakTreatmentStatus = 'pending' | 'closed';

type ListSakInnstillingFields = {
  innstilling_id?: number;
  innstilling_kode?: number;
};

type SakDetailStatusFields = {
  ferdigbehandlet?: boolean | null;
  status?: number | null;
};

/** Stortinget list export can keep status=1 while detail has ferdigbehandlet=true. */
export function resolveSakListStatus(input: {
  ferdigbehandlet?: boolean | null;
  numericStatus?: number | null;
  cachedStatus?: string | null;
}): SakTreatmentStatus {
  if (input.ferdigbehandlet === true) return 'closed';
  if (input.ferdigbehandlet === false) {
    return input.numericStatus === 1 ? 'pending' : 'closed';
  }
  if (input.cachedStatus === 'closed') return 'closed';
  if (input.numericStatus === 1) return 'pending';
  if (input.numericStatus != null) return 'closed';
  if (input.cachedStatus === 'pending') return 'pending';
  return 'closed';
}

/** Prefer cached detail / DB column over list-export heuristics. */
export function resolveSakStatusFromSources(input: {
  ferdigbehandlet?: boolean | null;
  detailJson?: SakDetailStatusFields | null;
  cachedStatus?: string | null;
  numericStatus?: number | null;
  listInnstilling?: ListSakInnstillingFields | null;
}): SakTreatmentStatus {
  const detailFerdigbehandlet =
    typeof input.detailJson?.ferdigbehandlet === 'boolean' ? input.detailJson.ferdigbehandlet : null;
  const effectiveFerdigbehandlet =
    typeof input.ferdigbehandlet === 'boolean'
      ? input.ferdigbehandlet
      : detailFerdigbehandlet;
  const numericStatus =
    input.numericStatus ??
    (typeof input.detailJson?.status === 'number' ? input.detailJson.status : null);

  if (typeof effectiveFerdigbehandlet === 'boolean') {
    return resolveSakListStatus({
      ferdigbehandlet: effectiveFerdigbehandlet,
      numericStatus,
      cachedStatus: input.cachedStatus,
    });
  }

  return resolveSakListStatus({
    ferdigbehandlet: inferFerdigbehandletFromListSak(input.listInnstilling ?? {}),
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

/** List export keeps status=1 for many finished saker; innstilling fields are a reliable hint. */
export function inferFerdigbehandletFromListSak(sak: ListSakInnstillingFields): boolean | undefined {
  if (
    typeof sak.innstilling_id === 'number' &&
    sak.innstilling_id > 0 &&
    (sak.innstilling_kode === 1 || sak.innstilling_kode === 2)
  ) {
    return true;
  }
  return undefined;
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
