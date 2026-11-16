'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { formatStemmerCount } from '@/lib/norwegian-plural';
import { POLL_ENDED_USER_MESSAGE } from '@/lib/polls/format';
import { PollDistributionAwaitingAggregateNote } from '@/components/polls/poll-distribution-awaiting-aggregate';
import {
  redactPollTotalsForViewer,
  shouldShowPollDistributionAwaitingNote,
} from '@/lib/polls/poll-distribution-reveal';
import { pollBallotRunningTextPhraseSentenceStart } from '@/lib/polls/ballot-buttons';
import { pollChoiceLabel } from '@/lib/polls/labels';
import type { PollChoice, PollTotals } from '@/lib/polls/types';
import {
  PollBallotDistributionBar,
  PollBallotDistributionBarDisplay,
} from '@/components/polls/poll-ballot-distribution-bar';
import { routes } from '@/lib/routes';
import { NonRepresentativeNotice } from '@/components/trust/non-representative-notice';
import { cn } from '@/lib/utils';

type PollBallotProps = {
  pollId: string;
  votingOpen: boolean;
  initialTotals: PollTotals;
  initialVote: PollChoice | null;
  loginNext?: string;
  compact?: boolean;
};

export function PollBallot({
  pollId,
  votingOpen,
  initialTotals,
  initialVote,
  loginNext,
  compact = false,
}: PollBallotProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [totals, setTotals] = useState(initialTotals);
  const [userVote, setUserVote] = useState<PollChoice | null>(initialVote);
  const hasVoted = Boolean(userVote);
  const viewerTotals = redactPollTotalsForViewer(totals, votingOpen, hasVoted);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const vote = async (choice: PollChoice) => {
    if (!votingOpen || userVote || busy) return;
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(loginNext ?? routes.poll(pollId))}`);
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
      if (data.totals) setTotals(data.totals);
      setUserVote(choice);
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn(!compact && 'rounded-2xl border border-border bg-card p-5 shadow-sm')}>
      {compact ? null : (
        <>
          <h2 className="text-base font-semibold text-foreground">Hva mener du?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {pollBallotRunningTextPhraseSentenceStart()}. Stemmen telles i samlet statistikk uten navn.
          </p>
          <NonRepresentativeNotice count={totals.total} countLabel="stemmer" countLabelSingular="stemme" className="mt-2" />
        </>
      )}
      {votingOpen ? (
        <PollBallotDistributionBar
          totals={viewerTotals}
          votingOpen={votingOpen}
          userVote={userVote}
          busy={busy}
          disabled={!user}
          onVote={(choice) => void vote(choice)}
          compact={compact}
          className={compact ? 'mt-0' : 'mt-4'}
        />
      ) : null}
      {votingOpen && compact && !hasVoted ? (
        <p className="mt-2 text-sm text-muted-foreground">{formatStemmerCount(totals.total)}</p>
      ) : null}
      {votingOpen && shouldShowPollDistributionAwaitingNote(votingOpen, hasVoted, totals) ? (
        <PollDistributionAwaitingAggregateNote className={compact ? 'mt-2' : 'mt-3'} />
      ) : null}
      {!votingOpen ? (
        <>
          <p className={cn('text-sm font-medium text-foreground', compact ? 'mt-0' : 'mt-4')} role="status">
            {POLL_ENDED_USER_MESSAGE}
          </p>
          <PollBallotDistributionBarDisplay
            totals={viewerTotals}
            votingOpen={false}
            hasVoted={hasVoted}
            className={compact ? 'mt-3' : 'mt-4'}
          />
        </>
      ) : null}
      {votingOpen && userVote ? (
        <p className="mt-3 text-sm text-foreground">
          Du har stemt {pollChoiceLabel(userVote).toLowerCase()} (telles uten navn i statistikken).
        </p>
      ) : votingOpen && !user ? (
        <p className="mt-3 text-sm text-muted-foreground">
          <Link
            href={`${routes.login}?next=${encodeURIComponent(loginNext ?? routes.poll(pollId))}`}
            className="inline-flex min-h-11 items-center py-1 font-medium text-brand underline-offset-2 hover:underline"
          >
            Logg inn for å avgi stemme
          </Link>
          .
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
