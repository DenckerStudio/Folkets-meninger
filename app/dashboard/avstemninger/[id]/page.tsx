import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { PageHeader } from '@/components/page-header';
import { PollBallot } from '@/components/polls/poll-ballot';
import { PollResultView } from '@/components/polls/poll-result-view';
import { isAdmin } from '@/lib/admin/gate';
import { getServerSupabase } from '@/lib/supabase-server';
import { pollStatusLabel, pollTrackLabel, SYSTEM_REEL_DISCLAIMER } from '@/lib/polls/labels';
import {
  getPollById,
  getPollTotals,
  getPollTotalsByFylke,
  getUserPollVote,
  isPollVotingOpen,
} from '@/lib/polls/service';
import { isSharePollsEnabled } from '@/lib/polls/share-flag';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PollDetailPage({ params }: PageProps) {
  const { id } = await params;
  const poll = await getPollById(id);
  if (!poll || poll.track === 'citizen') notFound();

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [totals, byFylke, voteState] = await Promise.all([
    getPollTotals(id),
    getPollTotalsByFylke(id),
    user ? getUserPollVote(user.id, id) : Promise.resolve({ hasVoted: false, vote: null }),
  ]);

  const shareEnabled =
    isSharePollsEnabled() || (user ? await isAdmin(user.id, user.email) : false);

  return (
    <DashboardPage className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <Link
        href={poll.track === 'system' ? routes.utforsk : routes.avstemninger}
        className="-ml-1 inline-flex min-h-11 items-center rounded-md px-1 text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {poll.track === 'system' ? '← Utforsk' : '← Alle avstemninger'}
      </Link>
      <div className="flex flex-wrap gap-2 text-xs font-medium">
        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-brand">{pollTrackLabel(poll.track)}</span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
          {pollStatusLabel(poll.status)}
        </span>
      </div>
      <PageHeader title={poll.title} />
      {poll.track === 'system' ? (
        <p className="text-sm text-muted-foreground">{SYSTEM_REEL_DISCLAIMER}</p>
      ) : null}
      {poll.neutralSummary ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{poll.neutralSummary}</p>
      ) : null}
      {poll.stortingetIssueId ? (
        <p className="flex flex-wrap items-center gap-x-1 text-sm">
          Kilde:{' '}
          <Link
            href={routes.sak(poll.stortingetIssueId)}
            className="inline-flex min-h-11 items-center font-medium text-brand hover:underline"
          >
            Stortingssak {poll.stortingetIssueId}
          </Link>
        </p>
      ) : null}
      {poll.sourceUrls.length > 0 ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {poll.sourceUrls.map((source) => (
            <li key={source.url}>
              <a href={source.url} className="inline-flex min-h-11 items-center break-all text-brand hover:underline"
                rel="noreferrer"
                target="_blank">
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
      {shareEnabled ? (
        <p className="text-sm">
          <Link
            href={routes.sharePoll(poll.id)}
            className="inline-flex min-h-11 items-center font-medium text-brand hover:underline"
          >
            Åpne delbar side (Ja / Vet ikke / Nei) →
          </Link>
        </p>
      ) : null}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Resultat per fylke</h2>
        <PollResultView byFylke={byFylke} />
      </section>
    </DashboardPage>
  );
}
