import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';
import type { PollFylkeTotals, PollTotals } from '@/lib/polls/types';

export const POLL_DISTRIBUTION_AWAITING_AGGREGATE_MESSAGE =
  'Fordelingen vises når minst 5 har stemt.';

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

/** Skjuler per-valg per fylke på åpne avstemninger for ikke-stemmere; k≥5 per rad når synlig. */
export function redactPollFylkeTotalsForViewer(
  rows: PollFylkeTotals[],
  votingOpen: boolean,
  hasVoted: boolean,
): PollFylkeTotals[] {
  const mayReveal = pollDistributionMayReveal(votingOpen, hasVoted);
  if (!mayReveal) {
    return rows.map((row) => ({
      ...row,
      ja: null,
      nei: null,
      blank: null,
      sufficientData: false,
    }));
  }
  return rows.map((row) => {
    if (!row.sufficientData || !publicAggregateMeetsThreshold(row.total)) {
      return {
        ...row,
        ja: null,
        nei: null,
        blank: null,
        sufficientData: false,
      };
    }
    return row;
  });
}