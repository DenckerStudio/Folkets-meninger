import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SharePollWidget } from '@/components/polls/share-poll-widget';
import { isAdmin } from '@/lib/admin/gate';
import {
  DEFAULT_DESCRIPTION,
  SITE_LOCALE,
  SITE_NAME,
  truncateDescription,
} from '@/lib/seo/metadata';
import {
  getPollTotals,
  getPublicPollById,
  getUserPollVote,
  isPollVotingOpen,
} from '@/lib/polls/service';
import {
  buildPollShareUrl,
  DEFAULT_SITE_ORIGIN,
  isPollChoice,
  isShareablePoll,
  pollSharePath,
} from '@/lib/polls/share';
import { OG_IMAGE_ALT, OG_IMAGE_SIZE, pollOgImageAlt } from '@/lib/polls/share-og';
import { isSharePollsEnabled } from '@/lib/polls/share-flag';
import { resolveRequestShareOrigin } from '@/lib/polls/share-server';
import { POLL_BALLOT_OPTIONS_PHRASE, SYSTEM_REEL_DISCLAIMER } from '@/lib/polls/labels';
import { getServerSupabase } from '@/lib/supabase-server';
import { routes } from '@/lib/routes';

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
  const { id } = await params;
  const [poll, origin] = await Promise.all([
    getPublicPollById(id).catch(() => null),
    resolveRequestShareOrigin().catch(() => DEFAULT_SITE_ORIGIN),
  ]);
  const shareable = isShareablePoll(poll) && Boolean(poll);

  const title = shareable && poll ? poll.title : SITE_NAME;
  const description =
    shareable && poll
      ? poll.neutralSummary.trim()
        ? truncateDescription(poll.neutralSummary, 155)
        : `Stem ${POLL_BALLOT_OPTIONS_PHRASE}. Se hva andre mener på Folkets Meninger.`
      : DEFAULT_DESCRIPTION;

  const canonical = pollSharePath(id);
  const version = shareable && poll ? poll.updatedAt : 'generic';
  const image = {
    url: `${canonical}/opengraph-image?v=${encodeURIComponent(version)}`,
    ...OG_IMAGE_SIZE,
    alt: shareable && poll ? pollOgImageAlt(poll.title) : OG_IMAGE_ALT,
  };

  return {
    metadataBase: new URL(`${origin}/`),
    title: shareable && poll ? `${poll.title} – ${SITE_NAME}` : SITE_NAME,
    description,
    alternates: { canonical },
    openGraph: {
      // No brand suffix — `siteName` already carries the brand under the card.
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: 'website',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function SharePollPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const enabled = isSharePollsEnabled() || (user ? await isAdmin(user.id, user.email) : false);
  if (!enabled) notFound();

  const poll = await getPublicPollById(id).catch(() => null);
  if (!poll || !isShareablePoll(poll)) notFound();

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

  const summary = poll.neutralSummary.trim();
  const truncatedSummary = summary ? truncateDescription(summary, 160) : '';
  const summaryIsTruncated = truncatedSummary !== summary;

  return (
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
        />
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {poll.track === 'system' ? SYSTEM_REEL_DISCLAIMER : STORTINGET_DISCLAIMER}
      </p>

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
  );
}
