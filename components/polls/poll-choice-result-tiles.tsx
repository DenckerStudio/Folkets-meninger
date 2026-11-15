import { pollChoicePercent } from '@/lib/polls/format';
import { ballotShouldShowDistribution } from '@/lib/polls/ballot-distribution-layout';
import { POLL_BALLOT_CHOICES, pollChoiceLabel } from '@/lib/polls/labels';
import { shouldShowPollDistributionAwaitingNote } from '@/lib/polls/poll-distribution-reveal';
import { PollDistributionAwaitingAggregateNote } from '@/components/polls/poll-distribution-awaiting-aggregate';
import type { PollTotals } from '@/lib/polls/types';
import { cn } from '@/lib/utils';

type PollChoiceResultTilesProps = {
  totals: PollTotals;
  votingOpen: boolean;
  hasVoted?: boolean;
  className?: string;
};

export function PollChoiceResultTiles({
  totals,
  votingOpen,
  hasVoted = false,
  className,
}: PollChoiceResultTilesProps) {
  if (shouldShowPollDistributionAwaitingNote(votingOpen, hasVoted, totals)) {
    return <PollDistributionAwaitingAggregateNote className={className} />;
  }

  if (!ballotShouldShowDistribution(totals, votingOpen, hasVoted)) {
    return null;
  }

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {POLL_BALLOT_CHOICES.map((choice) => {
        const pct = pollChoicePercent(totals, choice);
        return (
          <div
            key={choice}
            className="flex min-h-11 flex-col items-center justify-center rounded-xl border border-border bg-muted/40 px-3 py-2 text-center"
          >
            <p className="text-xs font-medium text-muted-foreground">{pollChoiceLabel(choice)}</p>
            <p className="text-base font-semibold tabular-nums text-foreground">
              {pct != null ? `${pct} %` : '—'}
            </p>
            {pct != null ? (
              <p className="text-xs tabular-nums text-muted-foreground">{totals[choice]}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}