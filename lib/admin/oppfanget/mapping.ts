import type {
  ActionClusterDbStatus,
  ActionTypeDb,
  OppfangetDisplayStatus,
  OppfangetDisplayType,
} from '@/lib/admin/oppfanget/types';

export function mapActionTypeToDisplayType(
  actionType: ActionTypeDb,
  opts?: { isSignal?: boolean },
): OppfangetDisplayType {
  if (opts?.isSignal) return 'melding';
  switch (actionType) {
    case 'boykott':
      return 'boikott';
    case 'opprop':
      return 'opprop';
    case 'demonstrasjon':
    case 'innsamling':
    case 'kampanje':
      return 'aksjon';
    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export function inferIsSignalRow(input: {
  clusterStatus: ActionClusterDbStatus;
  metadata: Record<string, unknown> | null;
  sourcesSignalOnly: boolean;
  hasNonSignalSource: boolean;
}): boolean {
  if (input.clusterStatus === 'not_action' && input.sourcesSignalOnly) return true;
  if (!input.hasNonSignalSource && input.sourcesSignalOnly) return true;
  return false;
}

export function mapClusterAndPollToDisplayStatus(
  clusterStatus: ActionClusterDbStatus,
  pollStatus: string | null | undefined,
): OppfangetDisplayStatus {
  if (clusterStatus === 'rejected' || clusterStatus === 'blocked') {
    return 'avvist';
  }
  if (pollStatus === 'open' || pollStatus === 'closed') {
    return 'publisert';
  }
  if (clusterStatus === 'drafted' || pollStatus === 'draft') {
    return 'utkast_laget';
  }
  if (clusterStatus === 'below_threshold') {
    return 'under_terskel';
  }
  return 'oppfanget';
}

export const OPPFANGET_DISPLAY_STATUS_LABELS: Record<OppfangetDisplayStatus, string> = {
  oppfanget: 'Oppfanget',
  under_terskel: 'Under terskel',
  utkast_laget: 'Utkast laget',
  publisert: 'Publisert',
  avvist: 'Avvist',
};

/** Admin status filter for clusters classified as not_action (hidden unless selected). */
export const OPPFANGET_FILTER_STATUS_LABEL_NOT_ACTION = 'Ikke aksjon';

export const OPPFANGET_DISPLAY_TYPE_LABELS: Record<OppfangetDisplayType, string> = {
  melding: 'Melding',
  opprop: 'Opprop',
  aksjon: 'Aksjon',
  boikott: 'Boikott',
};

export const ALL_OPPFANGET_DISPLAY_STATUSES: OppfangetDisplayStatus[] = [
  'oppfanget',
  'under_terskel',
  'utkast_laget',
  'publisert',
  'avvist',
];

export const ALL_OPPFANGET_DISPLAY_TYPES: OppfangetDisplayType[] = [
  'melding',
  'opprop',
  'aksjon',
  'boikott',
];
