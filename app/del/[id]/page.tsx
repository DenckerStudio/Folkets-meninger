import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PollShareLandingBeacon } from '@/components/analytics/poll-share-landing-beacon';
import { SharePollWidget } from '@/components/polls/share-poll-widget';
import { isAnalyticsEnabled } from '@/lib/analytics/flags';
import { truncateDescription } from '@/lib/seo/metadata';
import { buildDelSharePageMetadata, buildDisabledDelSharePageMetadata, buildRetiredDelSharePageMetadata } from '@/lib/polls/page-metadata';
import {
  isPublicSharePollRouteEnabled,
  isPublicSharePollRouteEnabledForRequest,
  resolvePublicSharePollRouteAccess,
} from '@/lib/polls/del-share-route';
import { resolvePublicPollSharePage } from '@/lib/polls/retired-system';
import {
  getPollTotals,
  getSharePagePollById,
  getUserPollVote,
  isPollVotingOpen,
} from '@/lib/polls/service';
import {
  buildPollShareUrl,
  isPollChoice,
  isShareablePoll,
} from '@/lib/polls/share';
import { resolveRequestShareOrigin } from '@/lib/polls/share-server';
import { getServerSupabase } from '@/lib/supabase-server';
import { routes } from '@/lib/routes';
import { SharePollRetiredPage } from '@/components/polls/share-poll-retired';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STORTINGET_DISCLAIMER =
  'Uoffisiell meningsmåling på Folkets Meninger. Ikke en avstemning i Stortinget.';

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const enabled = await isPublicSharePollRouteEnabledForRequest();
  if (!enabled) {
    return buildDisabledDelSharePageMetadata();
  }

  const { id } = await params;
  const resolved = await resolvePublicPollSharePage(id, getSharePagePollById);
  if (resolved.kind === 'retired') {
    return buildRetiredDelSharePageMetadata(id);
  }
  const poll = resolved.kind === 'ballot' ? resolved.poll : null;
  const totals =
    poll && isShareablePoll(poll) ? await getPollTotals(id).catch(() => null) : null;
  return buildDelSharePageMetadata({ poll, pollId: id, totals });
}

export default async function SharePollPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await resolvePublicSharePollRouteAccess();
  const enabled = isPublicSharePollRouteEnabled(access);
  if (!enabled) notFound();

  const resolved = await resolvePublicPollSharePage(id, getSharePagePollById);
  if (resolved.kind === 'missing') notFound();
  if (resolved.kind === 'retired') {
    return <SharePollRetiredPage />;
  }
  const poll = resolved.poll;
  if (!isShareablePoll(poll)) notFound();

  const [totals, voteState, origin] = await Promise.all([
    getPollTotals(id),
    user ? getUserPollVote(user.id, id) : Promise.resolve({ hasVoted: false, vote: null }),
    resolveRequestShareOrigin(),
  ]);

  const shareUrl = buildPollShareUrl(id, origin);
  const votingOpen = isPollVotingOpen(poll);
  const valgParam = firstParam(query.valg);
  const initialChoice = isPollChoice(valgParam) ? valgParam : null;
  const refCode = firstParam(query.ref);
  const utmSource = firstParam(query.utm_source);
  const utmMedium = firstParam(query.utm_medium);
  const utmCampaign = firstParam(query.utm_campaign);
  const fmShare = firstParam(query.fm_share);

  const summary = poll.neutralSummary.trim();
  const truncatedSummary = summary ? truncateDescription(summary, 160) : '';
  const summaryIsTruncated = truncatedSummary !== summary;

  return (
    <>
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-lg font-extrabold tracking-tight text-brand">Folkets</span>
          <span className="text-lg font-extrabold tracking-tight text-brand-accent">Meninger</span>
        </Link>
        <span className="text-xs font-medium text-muted-foreground">
          Spørsmål fra Folkets Meninger
        </span>
      </header>

      <section className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">
            Hva mener du?
          </p>
          <h1
            id="poll-question"
            className="text-2xl font-bold leading-snug tracking-tight text-foreground sm:text-3xl"
          >
            {poll.title}
          </h1>
          {summary ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {truncatedSummary}
              {summaryIsTruncated && poll.stortingetIssueId ? (
                <>
                  {' '}
                  <Link
                    href={routes.sak(poll.stortingetIssueId)}
                    className="font-medium text-brand hover:underline"
                  >
                    Les mer
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        <SharePollWidget
          pollId={poll.id}
          title={poll.title}
          votingOpen={votingOpen}
          initialTotals={totals}
          initialVote={voteState.vote}
          initialChoice={initialChoice}
          refCode={refCode}
          shareUrl={shareUrl}
          headingId="poll-question"
          shareDescription={summary ? truncateDescription(summary, 155) : undefined}
        />
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">{STORTINGET_DISCLAIMER}</p>

      {poll.stortingetIssueId ? (
        <p className="text-sm">
          Kilde:{' '}
          <Link
            href={routes.sak(poll.stortingetIssueId)}
            className="font-medium text-brand hover:underline"
          >
            Stortingssak {poll.stortingetIssueId}
          </Link>
        </p>
      ) : null}

      {poll.sourceUrls.length > 0 ? (
        <ul className="list-inside list-disc text-xs text-muted-foreground">
          {poll.sourceUrls.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                className="text-brand hover:underline"
                rel="noreferrer"
                target="_blank"
              >
                {source.label || source.url}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
    {isAnalyticsEnabled() ? (
      <PollShareLandingBeacon
        pollId={poll.id}
        utmSource={utmSource}
        utmMedium={utmMedium}
        utmCampaign={utmCampaign}
        refCode={refCode}
        fmShare={fmShare}
      />
    ) : null}
    </>
  );
}
