import type { InitiativeStatus, PollChoice, PollStatus, PollTrack } from '@/lib/polls/types';

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

export function pollTrackLabel(track: PollTrack): string {
  switch (track) {
    case 'stortinget':
      return 'Stortinget';
    case 'citizen':
      return 'Borgerinitiativ';
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

export function initiativeStatusLabel(status: InitiativeStatus): string {
  switch (status) {
    case 'gathering':
      return 'Samler støtte';
    case 'threshold_met':
      return 'Terskel nådd';
    case 'promoted':
      return 'Ble avstemning';
    case 'rejected':
      return 'Avvist';
    case 'withdrawn':
      return 'Trukket';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
