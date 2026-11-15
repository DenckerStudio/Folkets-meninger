import { pollChoicePercent } from '@/lib/polls/format';
import { ballotShouldShowDistribution } from '@/lib/polls/ballot-distribution-layout';
import { POLL_BALLOT_CHOICES, pollChoiceLabel } from '@/lib/polls/labels';
import type { PollTotals } from '@/lib/polls/types';
import { cn } from '@/lib/utils';

type PollChoiceResultTilesProps = {
  totals: PollTotals;
  hasVoted?: boolean;
  className?: string;
};

export function PollChoiceResultTiles({ totals, hasVoted = false, className }: PollChoiceResultTilesProps) {
  if (!ballotShouldShowDistribution(totals, hasVoted)) return null;

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {POLL_BALLOT_CHOICES.map((choice) => (
        <div key={choice} className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-center">
          <p className="text-xs font-medium text-muted-foreground">{pollChoiceLabel(choice)}</p>
          <p className="text-lg font-semibold text-foreground">
            {(() => {
              const pct = pollChoicePercent(totals, choice);
              return pct != null ? `${pct}%` : '—';
            })()}
          </p>
          <p className="text-xs text-muted-foreground">
            {(() => {
              const pct = pollChoicePercent(totals, choice);
              return pct != null ? totals[choice] : null;
            })()}
          </p>
        </div>
      ))}
    </div>
  );
}
