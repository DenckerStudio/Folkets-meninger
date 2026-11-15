'use client';

import { PollBallot } from '@/components/polls/poll-ballot';
import type { PollChoice, PollTotals } from '@/lib/polls/types';
import { redactPollTotalsForViewer } from '@/lib/polls/poll-distribution-reveal';

type PublicTopicPollBallotProps = {
  pollId: string;
  votingOpen: boolean;
  rawTotals: PollTotals;
  initialVote: PollChoice | null;
  loginNext: string;
};

export function PublicTopicPollBallot({
  pollId,
  votingOpen,
  rawTotals,
  initialVote,
  loginNext,
}: PublicTopicPollBallotProps) {
  const hasVoted = Boolean(initialVote);
  const ballotTotals = redactPollTotalsForViewer(rawTotals, votingOpen, hasVoted);

  return (
    <PollBallot
      pollId={pollId}
      votingOpen={votingOpen}
      initialTotals={ballotTotals}
      initialVote={initialVote}
      loginNext={loginNext}
      compact
    />
  );
}