import type { PollChoice, PollStatus, PollTrack } from '@/lib/polls/types';

export function pollChoiceLabel(choice: PollChoice): string {
  switch (choice) {
    case 'ja':
      return 'Ja';
    case 'nei':
      return 'Nei';
    case 'blank':
      return 'Blank';
    default: {
      const _exhaustive: never = choice;
      return _exhaustive;
    }
  }
}

export const SYSTEM_REEL_DISCLAIMER =
  'Systemgenerert fra stortingssaker og godkjent av admin. Ikke en offisiell Stortinget-avstemning.';

export function pollTrackLabel(track: PollTrack): string {
  switch (track) {
    case 'stortinget':
      return 'Stortinget';
    case 'citizen':
      return 'Avviklet';
    case 'system':
      return 'Systemgenerert';
    default: {
      const _exhaustive: never = track;
      return _exhaustive;
    }
  }
}

export function pollStatusLabel(status: PollStatus): string {
  switch (status) {
    case 'draft':
      return 'Utkast';
    case 'open':
      return 'Åpen';
    case 'closed':
      return 'Stengt';
    case 'archived':
      return 'Arkivert';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
