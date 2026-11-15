import { pollChoiceLabel } from '@/lib/polls/labels';
import { POLL_BALLOT_CHOICES } from '@/lib/polls/labels';
import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';
import type { PollChoice, PollTotals } from '@/lib/polls/types';

export const BALLOT_SEGMENT_MIN_WIDTH_REM = 5.5;

export function ballotShowProportionalLayout(
  totals: PollTotals,
  showResultsBeforeVote: boolean,
): boolean {
  return showResultsBeforeVote && publicAggregateMeetsThreshold(totals.total);
}

/** Proportional grow by vote count; 0 keeps min-width only (never max(count, 1)). */
export function ballotSegmentFlexGrow(
  totals: PollTotals,
  choice: PollChoice,
  proportional: boolean,
): number {
  if (!proportional) return 1;
  return totals[choice];
}

export function formatPollBallotDistributionSummary(
  totals: PollTotals,
  percents: Record<PollChoice, number | null>,
  showNumbers: boolean,
): string {
  if (!showNumbers) {
    if (totals.total === 0) {
      return 'Nei, Blank og Ja — ingen stemmer ennå.';
    }
    const stemmer = totals.total === 1 ? '1 stemme' : `${totals.total} stemmer`;
    return `Nei, Blank og Ja — ${stemmer} (prosent vises når minst 5 har stemt).`;
  }

  const parts = POLL_BALLOT_CHOICES.map((choice) => {
    const pct = percents[choice];
    return pct != null ? `${pollChoiceLabel(choice)} ${pct} %` : pollChoiceLabel(choice);
  });
  const stemmer = totals.total === 1 ? '1 stemme' : `${totals.total} stemmer`;
  return `${parts.join(', ')}, ${stemmer}`;
}