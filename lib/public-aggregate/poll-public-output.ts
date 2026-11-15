import { pollChoicePercent } from '@/lib/polls/format';
import type { PollChoice, PollTotals } from '@/lib/polls/types';
import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';

export type PublicPollTotals = {
  ja: number | null;
  nei: number | null;
  blank: number | null;
  total: number;
};

export const POLL_AGGREGATE_BELOW_THRESHOLD_NOTE =
  'Det er for få svar ennå til at vi kan vise fordeling. Du kan fortsatt stemme når avstemningen er åpen.';

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