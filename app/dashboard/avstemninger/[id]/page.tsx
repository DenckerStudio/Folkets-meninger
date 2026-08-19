import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PollBallot } from '@/components/polls/poll-ballot';
import { PollResultView } from '@/components/polls/poll-result-view';
import { getServerSupabase } from '@/lib/supabase-server';
import { pollStatusLabel, pollTrackLabel } from '@/lib/polls/labels';
import {
  getPollById,
  getPollTotals,
  getPollTotalsByFylke,
  getUserPollVote,
  isPollVotingOpen,
} from '@/lib/polls/service';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PollDetailPage({ params }: PageProps) {
  const { id } = await params;
  const poll = await getPollById(id);
  if (!poll) notFound();

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [totals, byFylke, voteState] = await Promise.all([
    getPollTotals(id),
    getPollTotalsByFylke(id),
    user ? getUserPollVote(user.id, id) : Promise.resolve({ hasVoted: false, vote: null }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <Link href={routes.avstemninger} className="text-sm font-medium text-brand hover:underline">
        ← Alle avstemninger
      </Link>
      <div className="flex flex-wrap gap-2 text-xs font-medium">
        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-brand">{pollTrackLabel(poll.track)}</span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
          {pollStatusLabel(poll.status)}
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{poll.title}</h1>
      {poll.neutralSummary ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{poll.neutralSummary}</p>
      ) : null}
      {poll.stortingetIssueId ? (
        <p className="text-sm">
          Kilde:{' '}
          <Link href={routes.sak(poll.stortingetIssueId)} className="font-medium text-brand hover:underline">
            Stortingssak {poll.stortingetIssueId}
          </Link>
        </p>
      ) : null}
      {poll.sourceUrls.length > 0 ? (
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          {poll.sourceUrls.map((source) => (
            <li key={source.url}>
              <a href={source.url} className="text-brand hover:underline" rel="noreferrer" target="_blank">
                {source.label || source.url}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <PollBallot
        pollId={poll.id}
        votingOpen={isPollVotingOpen(poll)}
        initialTotals={totals}
        initialVote={voteState.vote}
      />
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Resultat per fylke</h2>
        <PollResultView byFylke={byFylke} />
      </section>
    </div>
  );
}
