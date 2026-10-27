import type { PollChoice } from '@/lib/polls/types';

/**
 * Three-button ballot layout (Nei / Blank / Ja). Matches Reels card vote colors.
 * Stored vote values remain `ja` | `nei` | `blank`.
 */
export const POLL_BALLOT_BUTTON_ORDER: PollChoice[] = ['nei', 'blank', 'ja'];

/** All valid stored vote values (order-independent). */
export const POLL_VOTE_VALUES: PollChoice[] = ['ja', 'nei', 'blank'];

/** Reels-aligned surface classes per choice (dashboard + `/del`). */
export function pollBallotVoteButtonClassName(choice: PollChoice): string {
  switch (choice) {
    case 'nei':
      return 'bg-[#ba0c2f] text-white hover:bg-[#ba0c2f]/90';
    case 'blank':
      return 'border border-[#00205b]/20 bg-white text-[#00205b] hover:bg-white/90 dark:border-white/40 dark:bg-white dark:text-[#00205b]';
    case 'ja':
      return 'bg-[#0a3d9e] text-white ring-1 ring-inset ring-white/45 hover:bg-[#0c4ab8]';
    default: {
      const _exhaustive: never = choice;
      return _exhaustive;
    }
  }
}

export function pollBallotVoteButtonSelectedRing(selected: boolean): string {
  if (!selected) return '';
  return 'ring-2 ring-[#00205b] ring-offset-2 ring-offset-background dark:ring-white/80';
}

/** Result bar / legend colors aligned with vote buttons. */
export const POLL_BALLOT_RESULT_BAR_CLASS: Record<PollChoice, string> = {
  nei: 'bg-[#ba0c2f]',
  blank: 'bg-white ring-1 ring-inset ring-[#00205b]/20',
  ja: 'bg-[#0a3d9e]',
};

export const POLL_BALLOT_VOTE_BUTTON_GRID_CLASS = 'grid grid-cols-3 gap-2';

export const POLL_BALLOT_VOTE_BUTTON_BASE_CLASS =
  'flex min-h-11 items-center justify-center rounded-xl px-1 py-2.5 text-sm font-bold tracking-wide transition-opacity disabled:cursor-not-allowed disabled:opacity-60 sm:px-2 sm:text-base';
