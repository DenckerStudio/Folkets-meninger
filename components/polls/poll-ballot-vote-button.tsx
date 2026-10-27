'use client';

import type { ReactNode } from 'react';
import {
  POLL_BALLOT_VOTE_BUTTON_BASE_CLASS,
  pollBallotVoteButtonClassName,
  pollBallotVoteButtonSelectedRing,
} from '@/lib/polls/ballot-buttons';
import type { PollChoice } from '@/lib/polls/types';
import { cn } from '@/lib/utils';

type PollBallotVoteButtonProps = {
  choice: PollChoice;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
};

/** Shared Nei / Blank / Ja vote control for dashboard polls and `/del`. */
export function PollBallotVoteButton({
  choice,
  selected,
  disabled,
  onClick,
  className,
  children,
}: PollBallotVoteButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        POLL_BALLOT_VOTE_BUTTON_BASE_CLASS,
        pollBallotVoteButtonClassName(choice),
        pollBallotVoteButtonSelectedRing(selected),
        className,
      )}
    >
      {children}
    </button>
  );
}
