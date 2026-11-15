'use client';

import { useId, type CSSProperties } from 'react';
import {
  POLL_BALLOT_VOTE_BUTTON_BASE_CLASS,
  pollBallotVoteButtonClassName,
  pollBallotVoteButtonSelectedRing,
} from '@/lib/polls/ballot-buttons';
import { pollChoiceLabel } from '@/lib/polls/labels';
import { formatPollBallotPercentDisplay, pollBallotPercents } from '@/lib/polls/format';
import {
  BALLOT_SEGMENT_MIN_WIDTH_REM,
  ballotSegmentFlexGrow,
  ballotShouldShowDistribution,
  formatPollBallotDistributionSummary,
} from '@/lib/polls/ballot-distribution-layout';
import type { PollChoice, PollTotals } from '@/lib/polls/types';
import { POLL_BALLOT_CHOICES } from '@/lib/polls/labels';
import { PollDistributionAwaitingAggregateNote } from '@/components/polls/poll-distribution-awaiting-aggregate';
import { shouldShowPollDistributionAwaitingNote } from '@/lib/polls/poll-distribution-reveal';
import { cn } from '@/lib/utils';

const SEGMENT_MIN_WIDTH = `${BALLOT_SEGMENT_MIN_WIDTH_REM}rem`;

function ballotSegmentStyle(flexGrow: number): CSSProperties {
  return {
    flexGrow,
    flexShrink: 0,
    flexBasis: SEGMENT_MIN_WIDTH,
    minWidth: SEGMENT_MIN_WIDTH,
    maxWidth: '100%',
  };
}

function segmentAriaLabel(
  choice: PollChoice,
  count: number,
  percent: number | null,
  showNumbers: boolean,
): string {
  const label = pollChoiceLabel(choice);
  if (!showNumbers || percent == null) {
    return `Stem ${label}`;
  }
  const stemmer = count === 1 ? '1 stemme' : `${count} stemmer`;
  return `Stem ${label}, ${stemmer}, ${percent} prosent`;
}

function segmentSurfaceClass(
  choice: PollChoice,
  isFirst: boolean,
  isLast: boolean,
): string {
  return cn(
    pollBallotVoteButtonClassName(choice),
    choice === 'blank' && 'border-y border-[#00205b]/25 dark:border-white/35',
    isFirst && 'rounded-l-xl',
    isLast && 'rounded-r-xl',
    !isFirst && choice !== 'blank' && 'border-l border-black/10',
  );
}

type SegmentContentProps = {
  choice: PollChoice;
  showNumbers: boolean;
  count: number;
  percent: number | null;
};

function SegmentContent({ choice, showNumbers, count, percent }: SegmentContentProps) {
  const label = pollChoiceLabel(choice);
  return (
    <span className="flex w-full max-w-full flex-col items-center justify-center gap-0.5 px-1 py-0.5 text-center leading-snug">
      <span className="text-xs font-bold sm:text-sm">{label}</span>
      {showNumbers && percent != null ? (
        <span className="w-full text-center text-[0.65rem] font-normal leading-snug opacity-95 sm:text-xs">
          <span className="block break-words">{formatPollBallotPercentDisplay(percent)}</span>
          <span className="block break-words">{count}</span>
        </span>
      ) : null}
    </span>
  );
}

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
  const reveal = ballotShouldShowDistribution(totals, votingOpen, Boolean(userVote));
  const proportional = reveal;
  const showNumbers = reveal;
  const percents = pollBallotPercents(totals);

  return (
    <div
      role="group"
      aria-label={`Stem ${POLL_BALLOT_CHOICES.map((c) => pollChoiceLabel(c)).join(', ')}`}
      className={cn(
        'flex w-full overflow-x-auto rounded-xl border border-border shadow-sm',
        'min-h-11',
        className,
      )}
    >
      {POLL_BALLOT_CHOICES.map((choice, index) => {
        const selected = userVote === choice || (pendingChoice === choice && !userVote);
        const dimmed = Boolean(userVote) && userVote !== choice;
        const segmentDisabled = disabled || !votingOpen || Boolean(userVote) || busy;
        const count = totals[choice];
        const percent = percents[choice];
        const flexGrow = ballotSegmentFlexGrow(totals, choice, proportional);

        return (
          <button
            key={choice}
            type="button"
            disabled={segmentDisabled}
            aria-pressed={selected}
            aria-label={segmentAriaLabel(choice, count, percent, showNumbers)}
            onClick={() => onVote(choice)}
            style={ballotSegmentStyle(flexGrow)}
            className={cn(
              POLL_BALLOT_VOTE_BUTTON_BASE_CLASS,
              'min-h-11 rounded-none border-0 shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              segmentSurfaceClass(choice, index === 0, index === POLL_BALLOT_CHOICES.length - 1),
              pollBallotVoteButtonSelectedRing(selected),
              compact ? 'text-xs sm:text-sm' : 'py-2',
              dimmed ? 'opacity-60' : '',
              busy ? 'cursor-wait' : '',
            )}
          >
            <SegmentContent
              choice={choice}
              showNumbers={showNumbers}
              count={count}
              percent={percent}
            />
          </button>
        );
      })}
    </div>
  );
}

type PollBallotDistributionBarDisplayProps = {
  totals: PollTotals;
  votingOpen: boolean;
  hasVoted: boolean;
  className?: string;
};

/** Read-only distribution bar for poll cards and closed ballots. */
export function PollBallotDistributionBarDisplay({
  totals,
  votingOpen,
  hasVoted,
  className,
}: PollBallotDistributionBarDisplayProps) {
  const summaryId = useId();
  const awaitingNote = shouldShowPollDistributionAwaitingNote(votingOpen, hasVoted, totals);
  if (awaitingNote) {
    return <PollDistributionAwaitingAggregateNote className={className} />;
  }

  const reveal = ballotShouldShowDistribution(totals, votingOpen, hasVoted);
  if (!reveal) {
    return null;
  }

  const proportional = reveal;
  const showNumbers = reveal;
  const percents = pollBallotPercents(totals);
  const summary = formatPollBallotDistributionSummary(totals, percents, showNumbers);

  return (
    <figure className={cn('space-y-2', className)}>
      <figcaption id={summaryId} className="text-xs text-muted-foreground">
        {summary}
      </figcaption>
      <ul
        role="img"
        aria-labelledby={summaryId}
        className={cn(
          'm-0 flex w-full list-none overflow-x-auto rounded-xl border border-border p-0',
          'min-h-11',
        )}
      >
        {POLL_BALLOT_CHOICES.map((choice, index) => {
          const flexGrow = ballotSegmentFlexGrow(totals, choice, proportional);
          const percent = percents[choice];

          return (
            <li
              key={choice}
              style={ballotSegmentStyle(flexGrow)}
              className={cn(
                'flex min-h-11 flex-col items-center justify-center',
                segmentSurfaceClass(choice, index === 0, index === POLL_BALLOT_CHOICES.length - 1),
              )}
            >
              <SegmentContent
                choice={choice}
                showNumbers={showNumbers}
                count={totals[choice]}
                percent={percent}
              />
            </li>
          );
        })}
      </ul>
    </figure>
  );
}