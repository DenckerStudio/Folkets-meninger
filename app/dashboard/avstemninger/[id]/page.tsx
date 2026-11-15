import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { PageHeader } from '@/components/page-header';
import { PollBallot } from '@/components/polls/poll-ballot';
import { PollRetiredNotice } from '@/components/polls/poll-retired-notice';
import { PollShareButton } from '@/components/polls/poll-share-button';
import { PollResultView } from '@/components/polls/poll-result-view';
import { isAdmin } from '@/lib/admin/gate';
import { getServerSupabase } from '@/lib/supabase-server';
import { formatPollDisplayTitle } from '@/lib/polls/display-title';
import { pollBallotRunningTextPhrase } from '@/lib/polls/ballot-buttons';
import { pollStatusLabel, pollTrackLabel } from '@/lib/polls/labels';
import {
  buildPollDetailPageMetadata,
  buildRetiredPollDetailPageMetadata,
} from '@/lib/polls/page-metadata';
import { isPublicAvstemningTrack } from '@/lib/polls/public-tracks';
import { getRetiredSystemPollById } from '@/lib/polls/retired-system';
import {
  getPollById,
  getPollTotals,
  getPollTotalsByFylke,
  getResearchTopicIdForPoll,
  getUserPollVote,
  isPollVotingOpen,
} from '@/lib/polls/service';
import {
  preparePollFylkeForViewer,
  redactPollTotalsForViewer,
} from '@/lib/polls/poll-distribution-reveal';
import { isShareablePoll } from '@/lib/polls/share';
import { isSharePollsEnabled } from '@/lib/polls/share-flag';
import { resolvePollSourceSakLink } from '@/lib/polls/stortinget-issue-link';
import { routes } from '@/lib/routes';
import { truncateDescription } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const retired = await getRetiredSystemPollById(id);
  if (retired) return buildRetiredPollDetailPageMetadata(id);

  const poll = await getPollById(id);
  if (!poll || !isPublicAvstemningTrack(poll.track)) return {};

  const totals = await getPollTotals(id).catch(() => ({
    ja: 0,
    nei: 0,
    blank: 0,
    total: 0,
  }));
  return buildPollDetailPageMetadata(poll, totals);
}

export default async function PollDetailPage({ params }: PageProps) {
  const { id } = await params;

  const retired = await getRetiredSystemPollById(id);
  if (retired) {
    return (
      <DashboardPage className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
        <Link
          href={routes.avstemninger}
          className="-ml-1 inline-flex min-h-11 items-center rounded-md px-1 text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          ← Alle avstemninger
        </Link>
        <PollRetiredNotice />
      </DashboardPage>
    );
  }

  const poll = await getPollById(id);
  if (!poll || !isPublicAvstemningTrack(poll.track)) notFound();

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [totals, byFylke, voteState] = await Promise.all([
    getPollTotals(id),
    getPollTotalsByFylke(id),
    user ? getUserPollVote(user.id, id) : Promise.resolve({ hasVoted: false, vote: null }),
  ]);

  const sharePageEnabled =
    isShareablePoll(poll) &&
    (isSharePollsEnabled() || (user ? await isAdmin(user.id, user.email) : false));

  const votingOpen = isPollVotingOpen(poll);
  const fylkeForViewer = preparePollFylkeForViewer(byFylke, votingOpen, voteState.hasVoted);

  const researchTopicId = await getResearchTopicIdForPoll(poll.id);
  const sakLink = resolvePollSourceSakLink(poll.stortingetIssueId, { researchTopicId });
  const sourceUrls = poll.sourceUrls.filter((source) => !sakLink || source.url !== sakLink.href);

  return (
    <DashboardPage className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <Link
        href={routes.avstemninger}
        className="-ml-1 inline-flex min-h-11 items-center rounded-md px-1 text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        ← Alle avstemninger
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-brand">{pollTrackLabel(poll.track)}</span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
            {pollStatusLabel(poll.status)}
          </span>
        </div>
        {isShareablePoll(poll) ? (
          <PollShareButton
            pollId={poll.id}
            title={formatPollDisplayTitle(poll.title)}
            description={
              poll.neutralSummary
                ? truncateDescription(poll.neutralSummary)
                : `Stem ${pollBallotRunningTextPhrase()}. Se hva andre mener på Folkets Meninger.`
            }
            sharePageEnabled={sharePageEnabled}
          />
        ) : null}
      </div>
      <PageHeader title={formatPollDisplayTitle(poll.title)} />
      {poll.neutralSummary ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{poll.neutralSummary}</p>
      ) : null}
      {sakLink ? (
        <p className="flex flex-wrap items-center gap-x-1 text-sm">
          Kilde:{' '}
          <Link
            href={sakLink.href}
            className="inline-flex min-h-11 items-center font-medium text-brand hover:underline"
          >
            {sakLink.kind === 'stortinget'
              ? `Stortingssak ${poll.stortingetIssueId}`
              : sakLink.label}
          </Link>
        </p>
      ) : null}
      {sourceUrls.length > 0 ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {sourceUrls.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                className="inline-flex min-h-11 items-center break-all text-brand hover:underline"
                rel="noreferrer"
                target="_blank"
              >
                {source.label || source.url}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <PollBallot
        pollId={poll.id}
        votingOpen={votingOpen}
        initialTotals={redactPollTotalsForViewer(totals, votingOpen, voteState.hasVoted)}
        initialVote={voteState.vote}
      />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Resultat per fylke</h2>
        <PollResultView
          byFylke={fylkeForViewer.byFylke}
          hiddenUntilVote={fylkeForViewer.hiddenUntilVote}
        />
      </section>
    </DashboardPage>
  );
}
