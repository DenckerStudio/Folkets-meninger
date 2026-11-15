import { POLL_DISTRIBUTION_AWAITING_AGGREGATE_MESSAGE } from '@/lib/polls/poll-distribution-reveal';
import { cn } from '@/lib/utils';

type PollDistributionAwaitingAggregateNoteProps = {
  className?: string;
};

export function PollDistributionAwaitingAggregateNote({
  className,
}: PollDistributionAwaitingAggregateNoteProps) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      {POLL_DISTRIBUTION_AWAITING_AGGREGATE_MESSAGE}
    </p>
  );
}