import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';
import type { PollChoice, PollTotals } from '@/lib/polls/types';
import { redactPublicPollTotals } from '@/lib/public-aggregate/poll-public-output';

const BALLOT_CHOICES: PollChoice[] = ['nei', 'blank', 'ja'];

/**
 * Totals safe to pass into PollBallot / result tiles on public surfaces.
 * Under k: per-choice counts are zeroed (no Ja/Nei/Blank fordeling), total kept for notices.
 */
export function publicPollBallotInitialTotals(raw: PollTotals): PollTotals {
  const redacted = redactPublicPollTotals(raw);
  if (redacted.ja != null && redacted.nei != null && redacted.blank != null) {
    return {
      ja: redacted.ja,
      nei: redacted.nei,
      blank: redacted.blank,
      total: redacted.total,
    };
  }
  return {
    ja: 0,
    nei: 0,
    blank: 0,
    total: raw.total,
  };
}

export function publicPollBallotPerChoiceCountsHidden(raw: PollTotals): boolean {
  return !publicAggregateMeetsThreshold(raw.total);
}

export function publicPollBallotTotalsContainPerChoiceCounts(totals: PollTotals): boolean {
  return BALLOT_CHOICES.some((choice) => totals[choice] > 0);
}