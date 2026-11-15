import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { PollChoiceResultTiles } from '@/components/polls/poll-choice-result-tiles';
import { PollDistributionAwaitingAggregateNote } from '@/components/polls/poll-distribution-awaiting-aggregate';
import { NonRepresentativeNotice } from '@/components/trust/non-representative-notice';
import { formatStemmerCount } from '@/lib/norwegian-plural';
import { isPollVotingOpen } from '@/lib/polls/format';
import {
  pollDistributionRevealAllowed,
  shouldShowPollDistributionAwaitingNote,
} from '@/lib/polls/poll-distribution-reveal';
import { findPublicPollForIssue, getPollTotals, getUserPollVote } from '@/lib/polls/service';
import { publicPollBallotInitialTotals } from '@/lib/public-aggregate/poll-ballot-public-totals';
import { getServerSupabase } from '@/lib/supabase-server';
import { routes } from '@/lib/routes';

type SakStortingetPollAggregateProps = {
  sakId: string;
};

export async function SakStortingetPollAggregate({ sakId }: SakStortingetPollAggregateProps) {
  let poll = null;
  try {
    poll = await findPublicPollForIssue(sakId);
  } catch {
    return null;
  }

  if (!poll) return null;

  let totals = { ja: 0, nei: 0, blank: 0, total: 0 };
  try {
    totals = await getPollTotals(poll.id);
  } catch {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground sm:p-5">
        Avstemningsresultat er ikke tilgjengelig akkurat nå.
      </section>
    );
  }

  const votingOpen = isPollVotingOpen(poll);
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const voteState = user
    ? await getUserPollVote(user.id, poll.id).catch(() => ({ hasVoted: false, vote: null }))
    : { hasVoted: false, vote: null };
  const hasVoted = voteState.hasVoted;

  const ballotTotals = publicPollBallotInitialTotals(totals, votingOpen, hasVoted);
  const showDistribution = pollDistributionRevealAllowed(votingOpen, hasVoted, totals);
  const showAwaitingNote = shouldShowPollDistributionAwaitingNote(votingOpen, hasVoted, totals);
  const showOpenStemCountOnly = votingOpen && !hasVoted;

  const srSummary = showDistribution
    ? `Avstemningsresultat på Folkets Meninger, ${formatStemmerCount(totals.total)}`
    : `${formatStemmerCount(totals.total)} på avstemningen`;

  return (
    <section
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
      aria-labelledby="sak-poll-aggregate-heading"
    >
      <p className="sr-only" id="sak-poll-aggregate-heading">
        {srSummary}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-brand" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">Avstemningsresultat</h2>
        </div>
        <Link
          href={routes.poll(poll.id)}
          className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Gå til avstemningen
        </Link>
      </div>
      {showDistribution ? (
        <>
          <PollChoiceResultTiles
            totals={ballotTotals}
            votingOpen={votingOpen}
            hasVoted={hasVoted}
            className="mt-4"
          />
          <NonRepresentativeNotice
            count={totals.total}
            countLabel="stemmer"
            countLabelSingular="stemme"
            className="mt-3"
          />
        </>
      ) : showAwaitingNote ? (
        <PollDistributionAwaitingAggregateNote className="mt-4" />
      ) : showOpenStemCountOnly ? (
        <p className="mt-4 text-sm text-muted-foreground">{formatStemmerCount(totals.total)}</p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{formatStemmerCount(totals.total)}</p>
      )}
    </section>
  );
}