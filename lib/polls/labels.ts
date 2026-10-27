import type { PollChoice, PollStatus, PollTrack } from '@/lib/polls/types';
import { POLL_BALLOT_BUTTON_ORDER } from '@/lib/polls/ballot-buttons';

/** Button order on ballots: Nei / Blank / Ja (Reels colors). Sak ballots stay For/Mot/Avstår. */
export const POLL_BALLOT_CHOICES: PollChoice[] = POLL_BALLOT_BUTTON_ORDER;

/** Short copy for ballot UIs and share metadata (matches {@link pollChoiceLabel}). */
export const POLL_BALLOT_OPTIONS_PHRASE = 'Ja, nei eller blank';

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
