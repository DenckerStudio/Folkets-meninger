import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';
import type { PollTotals } from '@/lib/polls/types';

/** Fordeling (stolpe/prosent/antall) vises bare etter egen stemme og når k ≥ 5. */
export function pollDistributionRevealAllowed(hasVoted: boolean, totals: PollTotals): boolean {
  return hasVoted && publicAggregateMeetsThreshold(totals.total);
}

/** Skjuler per-valg-tall for ikke-stemmere (beholder total). */
export function redactPollTotalsForViewer(totals: PollTotals, hasVoted: boolean): PollTotals {
  if (pollDistributionRevealAllowed(hasVoted, totals)) return totals;
  return { ja: 0, nei: 0, blank: 0, total: totals.total };
}