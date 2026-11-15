import type { PollTotals } from '@/lib/polls/types';
import {
  pollDistributionRevealAllowed,
  redactPollTotalsForViewer,
} from '@/lib/polls/poll-distribution-reveal';

/**
 * Totals safe for PollBallot / fliser på offentlige flater.
 * Følger reveal = (hasVoted || !votingOpen) && k≥5.
 */
export function publicPollBallotInitialTotals(
  raw: PollTotals,
  votingOpen: boolean,
  hasVoted: boolean,
): PollTotals {
  return redactPollTotalsForViewer(raw, votingOpen, hasVoted);
}

export function publicPollBallotPerChoiceCountsHidden(
  raw: PollTotals,
  votingOpen: boolean,
  hasVoted: boolean,
): boolean {
  return !pollDistributionRevealAllowed(votingOpen, hasVoted, raw);
}

export function publicPollBallotTotalsContainPerChoiceCounts(totals: PollTotals): boolean {
  return totals.ja > 0 || totals.nei > 0 || totals.blank > 0;
}