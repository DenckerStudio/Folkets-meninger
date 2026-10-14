import type { PollChoice } from '@/lib/polls/types';
import type { OpinionCreateStance, OpinionStance } from '@/lib/opinions/types';
import type { IssueStance } from '@/lib/stances/types';

/**
 * Single place where the three stance vocabularies meet:
 *  - Reels/polls use `ja` / `nei` / `blank`
 *  - issue_stances use `enig` / `uenig` / `ikke_interessert`
 *  - citizen opinions use `for` / `blank` / `imot`
 *
 * A ja/nei vote on a Stortinget-backed poll is the same signal as an
 * issue stance, and maps onto the opinion composer's for/imot stance.
 */
export function issueStanceFromPollChoice(choice: PollChoice): IssueStance {
  switch (choice) {
    case 'ja':
      return 'enig';
    case 'nei':
      return 'uenig';
    case 'blank':
      return 'ikke_interessert';
    default: {
      const _exhaustive: never = choice;
      return _exhaustive;
    }
  }
}

export function pollChoiceFromIssueStance(stance: IssueStance): PollChoice {
  switch (stance) {
    case 'enig':
      return 'ja';
    case 'uenig':
      return 'nei';
    case 'ikke_interessert':
      return 'blank';
    default: {
      const _exhaustive: never = stance;
      return _exhaustive;
    }
  }
}

export function opinionStanceFromIssueStance(stance: IssueStance): OpinionStance {
  switch (stance) {
    case 'enig':
      return 'for';
    case 'uenig':
      return 'imot';
    case 'ikke_interessert':
      return 'blank';
    default: {
      const _exhaustive: never = stance;
      return _exhaustive;
    }
  }
}

/**
 * A blank vote or an "ikke interessert" stance carries no for/imot direction,
 * so it cannot pre-fill the opinion composer.
 */
export function opinionCreateStanceFromIssueStance(stance: IssueStance): OpinionCreateStance | null {
  switch (stance) {
    case 'enig':
      return 'for';
    case 'uenig':
      return 'imot';
    case 'ikke_interessert':
      return null;
    default: {
      const _exhaustive: never = stance;
      return _exhaustive;
    }
  }
}

export function opinionCreateStanceFromPollChoice(choice: PollChoice): OpinionCreateStance | null {
  return opinionCreateStanceFromIssueStance(issueStanceFromPollChoice(choice));
}

/** Query param used to carry a pre-selected stance into the opinion composer. */
export const STANCE_QUERY_PARAM = 'standpunkt';

export function parseOpinionCreateStanceParam(value: unknown): OpinionCreateStance | null {
  return value === 'for' || value === 'imot' ? value : null;
}
