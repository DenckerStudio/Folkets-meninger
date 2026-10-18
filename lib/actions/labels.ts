import type { ActionClusterStatus, ActionType } from '@/lib/actions/types';

export function actionClusterStatusLabel(status: ActionClusterStatus): string {
  switch (status) {
    case 'candidate':
      return 'Kandidat';
    case 'below_threshold':
      return 'Under terskel';
    case 'manual_only':
      return 'Kun manuelt';
    case 'blocked':
      return 'Blokkert';
    case 'would_draft':
      return 'Klar for utkast';
    case 'drafted':
      return 'Utkast laget';
    case 'rejected':
      return 'Avvist';
    case 'not_action':
      return 'Ikke en aksjon';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function actionTypeLabel(type: ActionType): string {
  switch (type) {
    case 'boykott':
      return 'Boikott';
    case 'opprop':
      return 'Opprop';
    case 'demonstrasjon':
      return 'Demonstrasjon';
    case 'innsamling':
      return 'Innsamling';
    case 'kampanje':
      return 'Kampanje';
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
