import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';
import type { PollFylkeTotals, PollFylkeViewerPayload, PollTotals } from '@/lib/polls/types';

export const POLL_DISTRIBUTION_AWAITING_AGGREGATE_MESSAGE =
  'Fordelingen vises når minst 5 har stemt.';

export const POLL_FYLKE_HIDDEN_UNTIL_VOTE_MESSAGE =
  'Fylkesfordelingen vises når du har stemt.';

/**
 * Fordeling vises når (hasVoted || !votingOpen) og k ≥ 5.
 * Åpen: kun etter egen stemme. Avsluttet: for alle.
 */
export function pollDistributionRevealAllowed(
  votingOpen: boolean,
  hasVoted: boolean,
  totals: PollTotals,
): boolean {
  const mayReveal = hasVoted || !votingOpen;
  return mayReveal && publicAggregateMeetsThreshold(totals.total);
}

export function pollDistributionMayReveal(votingOpen: boolean, hasVoted: boolean): boolean {
  return hasVoted || !votingOpen;
}

/** Melding når bruker/kontekst har rett til fordeling, men total &lt; k. */
export function shouldShowPollDistributionAwaitingNote(
  votingOpen: boolean,
  hasVoted: boolean,
  totals: PollTotals,
): boolean {
  return pollDistributionMayReveal(votingOpen, hasVoted) && !publicAggregateMeetsThreshold(totals.total);
}

/** Skjuler per-valg-tall for åpne avstemninger når brukeren ikke har stemt. */
export function redactPollTotalsForViewer(
  totals: PollTotals,
  votingOpen: boolean,
  hasVoted: boolean,
): PollTotals {
  if (pollDistributionRevealAllowed(votingOpen, hasVoted, totals)) return totals;
  return { ja: 0, nei: 0, blank: 0, total: totals.total };
}

/** Fylke til API/side: tom liste + flagg når åpen og ikke stemt; ellers k≥5 per rad. */
export function preparePollFylkeForViewer(
  rows: PollFylkeTotals[],
  votingOpen: boolean,
  hasVoted: boolean,
): PollFylkeViewerPayload {
  if (votingOpen && !hasVoted) {
    return { hiddenUntilVote: true, byFylke: [] };
  }

  const byFylke = rows.map((row) => {
    if (!publicAggregateMeetsThreshold(row.total)) {
      return {
        ...row,
        ja: null,
        nei: null,
        blank: null,
        sufficientData: false,
        hiddenUntilVote: false,
      };
    }
    return { ...row, hiddenUntilVote: false };
  });

  return { hiddenUntilVote: false, byFylke };
}