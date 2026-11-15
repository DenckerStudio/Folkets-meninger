'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PollBallot } from '@/components/polls/poll-ballot';
import { useAuth } from '@/hooks/use-auth';
import {
  POLL_BALLOT_VOTE_BUTTON_GRID_CLASS,
  pollBallotVoteButtonClassName,
  pollBallotVoteButtonSelectedRing,
} from '@/lib/polls/ballot-buttons';
import { POLL_BALLOT_CHOICES, pollChoiceLabel } from '@/lib/polls/labels';
import type { PollChoice, PollTotals } from '@/lib/polls/types';
import {
  publicPollBallotInitialTotals,
  publicPollBallotPerChoiceCountsHidden,
} from '@/lib/public-aggregate/poll-ballot-public-totals';
import { POLL_PUBLIC_AGGREGATE_BELOW_THRESHOLD_LABEL } from '@/lib/public-aggregate/poll-public-output';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type PublicTopicPollBallotProps = {
  pollId: string;
  votingOpen: boolean;
  rawTotals: PollTotals;
  initialVote: PollChoice | null;
  loginNext: string;
};

function VoteOnlyBallot({
  pollId,
  votingOpen,
  rawTotals,
  initialVote,
  loginNext,
}: PublicTopicPollBallotProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [userVote, setUserVote] = useState<PollChoice | null>(initialVote);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const vote = async (choice: PollChoice) => {
    if (!votingOpen || userVote || busy) return;
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(loginNext)}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId, choice }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke registrere stemme');
        return;
      }
      setUserVote(choice);
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className={cn(POLL_BALLOT_VOTE_BUTTON_GRID_CLASS, 'mt-0')}>
        {POLL_BALLOT_CHOICES.map((choice) => {
          const selected = userVote === choice;
          return (
            <button
              key={choice}
              type="button"
              disabled={Boolean(userVote) || busy || !user}
              onClick={() => void vote(choice)}
              className={cn(
                'min-h-11 rounded-xl px-3 py-2 text-sm font-semibold',
                pollBallotVoteButtonClassName(choice),
                pollBallotVoteButtonSelectedRing(selected),
                userVote && !selected ? 'opacity-60' : '',
              )}
            >
              {pollChoiceLabel(choice)}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-[#001433]/65" role="status">
        {POLL_PUBLIC_AGGREGATE_BELOW_THRESHOLD_LABEL}
      </p>
      {votingOpen && userVote ? (
        <p className="text-sm text-[#001433]">
          Du har stemt {pollChoiceLabel(userVote).toLowerCase()} (telles uten navn i statistikken).
        </p>
      ) : votingOpen && !user ? (
        <p className="text-sm text-[#001433]/65">
          <Link
            href={`${routes.login}?next=${encodeURIComponent(loginNext)}`}
            className="font-medium text-[#00205b] hover:underline"
          >
            Logg inn for å avgi stemme
          </Link>
          .
        </p>
      ) : null}
      {error ? <p className="text-sm text-[#ba0c2f]">{error}</p> : null}
      <span className="sr-only">
        {rawTotals.total > 0 ? `${rawTotals.total} stemmer registrert` : 'Ingen stemmer ennå'}
      </span>
    </div>
  );
}

export function PublicTopicPollBallot({
  pollId,
  votingOpen,
  rawTotals,
  initialVote,
  loginNext,
}: PublicTopicPollBallotProps) {
  const hideBreakdown = publicPollBallotPerChoiceCountsHidden(rawTotals);
  const ballotTotals = publicPollBallotInitialTotals(rawTotals);

  if (hideBreakdown) {
    return (
      <VoteOnlyBallot
        pollId={pollId}
        votingOpen={votingOpen}
        rawTotals={rawTotals}
        initialVote={initialVote}
        loginNext={loginNext}
      />
    );
  }

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