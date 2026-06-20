export type SakTreatmentStatus = 'pending' | 'closed';

type ListSakInnstillingFields = {
  innstilling_id?: number;
  innstilling_kode?: number;
};

/** Stortinget list export can keep status=1 while detail has ferdigbehandlet=true. */
export function resolveSakListStatus(input: {
  ferdigbehandlet?: boolean | null;
  numericStatus?: number | null;
  cachedStatus?: string | null;
}): SakTreatmentStatus {
  if (input.ferdigbehandlet === true) return 'closed';
  if (input.cachedStatus === 'closed') return 'closed';
  if (input.ferdigbehandlet === false) {
    return input.numericStatus === 1 ? 'pending' : 'closed';
  }
  if (input.numericStatus === 1) return 'pending';
  return 'closed';
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
