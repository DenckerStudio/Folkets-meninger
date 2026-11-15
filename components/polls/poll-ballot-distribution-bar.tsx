'use client';

import {
  POLL_BALLOT_VOTE_BUTTON_BASE_CLASS,
  pollBallotVoteButtonClassName,
  pollBallotVoteButtonSelectedRing,
} from '@/lib/polls/ballot-buttons';
import { pollChoiceLabel } from '@/lib/polls/labels';
import { pollBallotPercents } from '@/lib/polls/format';
import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';
import type { PollChoice, PollTotals } from '@/lib/polls/types';
import { POLL_BALLOT_CHOICES } from '@/lib/polls/labels';
import { cn } from '@/lib/utils';

type PollBallotDistributionBarProps = {
  totals: PollTotals;
  votingOpen: boolean;
  userVote: PollChoice | null;
  /** Pre-confirm highlight on `/del` (does not lock other choices). */
  pendingChoice?: PollChoice | null;
  busy?: boolean;
  disabled?: boolean;
  onVote: (choice: PollChoice) => void;
  className?: string;
  compact?: boolean;
};

function segmentFlexWeight(totals: PollTotals, choice: PollChoice, showDistribution: boolean): number {
  if (!showDistribution) return 1;
  return Math.max(totals[choice], 1);
}

type SegmentButtonProps = {
  choice: PollChoice;
  selected: boolean;
  disabled: boolean;
  flexWeight: number;
  showStats: boolean;
  count: number;
  percent: number | null;
  isFirst: boolean;
  isLast: boolean;
  onClick: () => void;
  compact?: boolean;
  className?: string;
};

function SegmentButton({
  choice,
  selected,
  disabled,
  flexWeight,
  showStats,
  count,
  percent,
  isFirst,
  isLast,
  onClick,
  compact,
  className,
}: SegmentButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      style={{ flexGrow: flexWeight, flexBasis: 0 }}
      className={cn(
        POLL_BALLOT_VOTE_BUTTON_BASE_CLASS,
        pollBallotVoteButtonClassName(choice),
        pollBallotVoteButtonSelectedRing(selected),
        'min-w-0 rounded-none border-0 px-1 shadow-none',
        choice === 'blank' && 'border-y border-[#00205b]/25 dark:border-white/35',
        isFirst && 'rounded-l-xl',
        isLast && 'rounded-r-xl',
        !isFirst && choice !== 'blank' && 'border-l border-black/10',
        compact ? 'py-1.5 text-xs sm:text-sm' : 'py-2',
        className,
      )}
    >
      <span className="truncate font-bold">{pollChoiceLabel(choice)}</span>
      {showStats && percent != null ? (
        <span className="text-[0.7rem] font-normal leading-tight opacity-95 sm:text-xs">
          {percent}% · {count}
        </span>
      ) : null}
    </button>
  );
}

/** Nei / Blank / Ja vote bar with proportional segments (shared dashboard + `/del`). */
export function PollBallotDistributionBar({
  totals,
  votingOpen,
  userVote,
  pendingChoice = null,
  busy = false,
  disabled = false,
  onVote,
  className,
  compact = false,
}: PollBallotDistributionBarProps) {
  const showStats = publicAggregateMeetsThreshold(totals.total);
  const percents = pollBallotPercents(totals);

  return (
    <div
      role="group"
      aria-label={`Stem ${POLL_BALLOT_CHOICES.map((c) => pollChoiceLabel(c)).join(', ')}`}
      className={cn(
        'flex w-full overflow-hidden rounded-xl border border-border shadow-sm',
        compact ? 'min-h-11' : 'min-h-[3.25rem]',
        className,
      )}
    >
      {POLL_BALLOT_CHOICES.map((choice, index) => {
        const selected = userVote === choice || (pendingChoice === choice && !userVote);
        const dimmed = Boolean(userVote) && userVote !== choice;
        const segmentDisabled = disabled || !votingOpen || Boolean(userVote) || busy;
        return (
          <SegmentButton
            key={choice}
            choice={choice}
            selected={selected}
            disabled={segmentDisabled}
            flexWeight={segmentFlexWeight(totals, choice, showStats)}
            showStats={showStats}
            count={totals[choice]}
            percent={percents[choice]}
            isFirst={index === 0}
            isLast={index === POLL_BALLOT_CHOICES.length - 1}
            onClick={() => onVote(choice)}
            compact={compact}
            className={cn(dimmed ? 'opacity-60' : '', busy ? 'cursor-wait' : '')}
          />
        );
      })}
    </div>
  );
}

type PollBallotDistributionBarDisplayProps = {
  totals: PollTotals;
  className?: string;
};

/** Read-only distribution bar for poll cards and closed ballots. */
export function PollBallotDistributionBarDisplay({
  totals,
  className,
}: PollBallotDistributionBarDisplayProps) {
  const showStats = publicAggregateMeetsThreshold(totals.total);
  const percents = pollBallotPercents(totals);

  return (
    <div
      className={cn(
        'flex w-full min-h-11 overflow-hidden rounded-xl border border-border',
        className,
      )}
      aria-label="Fordeling av stemmer"
    >
      {POLL_BALLOT_CHOICES.map((choice, index) => {
        const flexWeight = segmentFlexWeight(totals, choice, showStats);
        return (
          <div
            key={choice}
            style={{ flexGrow: flexWeight, flexBasis: 0 }}
            className={cn(
              'flex min-w-0 flex-col items-center justify-center px-1 py-2 text-center',
              pollBallotVoteButtonClassName(choice),
              choice === 'blank' && 'border-y border-[#00205b]/25 dark:border-white/35',
              index === 0 && 'rounded-l-xl',
              index === POLL_BALLOT_CHOICES.length - 1 && 'rounded-r-xl',
            )}
          >
            <span className="truncate text-xs font-bold sm:text-sm">{pollChoiceLabel(choice)}</span>
            {showStats && percents[choice] != null ? (
              <span className="text-[0.65rem] font-normal opacity-95 sm:text-xs">
                {percents[choice]}% · {totals[choice]}
              </span>
            ) : (
              <span className="sr-only">{pollChoiceLabel(choice)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}