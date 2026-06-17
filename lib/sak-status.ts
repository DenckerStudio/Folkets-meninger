export type SakTreatmentStatus = 'pending' | 'closed';

export function resolveSakTreatmentStatus(opts: {
  ferdigbehandlet?: boolean | null;
  numericStatus?: number | null;
}): SakTreatmentStatus {
  if (opts.ferdigbehandlet === true) return 'closed';
  if (opts.ferdigbehandlet === false) return 'pending';
  if (opts.numericStatus === 1) return 'pending';
  return 'pending';
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
