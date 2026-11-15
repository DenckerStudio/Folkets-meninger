import { pollChoicePercent } from '@/lib/polls/format';
import { pollDistributionRevealAllowed } from '@/lib/polls/poll-distribution-reveal';
import type { PollChoice, PollTotals } from '@/lib/polls/types';
import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';

export type PublicPollTotals = {
  ja: number | null;
  nei: number | null;
  blank: number | null;
  total: number;
};

export const POLL_PUBLIC_AGGREGATE_BELOW_THRESHOLD_LABEL =
  'For få stemmer til å vise fordeling';

export const POLL_AGGREGATE_BELOW_THRESHOLD_NOTE = `${POLL_PUBLIC_AGGREGATE_BELOW_THRESHOLD_LABEL}. Du kan fortsatt stemme når avstemningen er åpen.`;

export function redactPublicPollTotals(totals: PollTotals): PublicPollTotals {
  if (!publicAggregateMeetsThreshold(totals.total)) {
    return { ja: null, nei: null, blank: null, total: totals.total };
  }
  return {
    ja: totals.ja,
    nei: totals.nei,
    blank: totals.blank,
    total: totals.total,
  };
}

/** Samme reveal-regel som i appen, med PublicPollTotals-form (null = skjult valg). */
export function redactPublicPollTotalsForViewer(
  totals: PollTotals,
  votingOpen: boolean,
  hasVoted: boolean,
): PublicPollTotals {
  if (!pollDistributionRevealAllowed(votingOpen, hasVoted, totals)) {
    return { ja: null, nei: null, blank: null, total: totals.total };
  }
  return redactPublicPollTotals(totals);
}

export function publicPollPercentsNullable(
  totals: PollTotals,
): Record<PollChoice, number | null> {
  return {
    nei: pollChoicePercent(totals, 'nei'),
    blank: pollChoicePercent(totals, 'blank'),
    ja: pollChoicePercent(totals, 'ja'),
  };
}

export type PollUserMajority = 'ja' | 'nei' | 'tie';

export function pollUserMajority(totals: PollTotals): PollUserMajority | null {
  if (!publicAggregateMeetsThreshold(totals.total)) return null;
  if (totals.ja === totals.nei) return 'tie';
  return totals.ja > totals.nei ? 'ja' : 'nei';
}