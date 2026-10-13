import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SharePollWidget } from '@/components/polls/share-poll-widget';
import { EmbedThemeController } from '@/components/polls/embed-theme';
import { isAdmin } from '@/lib/admin/gate';
import {
  getPollTotals,
  getPublicPollById,
  getUserPollVote,
  isPollVotingOpen,
} from '@/lib/polls/service';
import { parsePollEmbedOptions } from '@/lib/polls/embed';
import { buildPollShareRelativePath, buildPollShareUrl, isShareablePoll } from '@/lib/polls/share';
import { isSharePollsEnabled } from '@/lib/polls/share-flag';
import { SYSTEM_REEL_DISCLAIMER } from '@/lib/polls/labels';
import { resolveRequestShareOrigin } from '@/lib/polls/share-server';
import { getServerSupabase } from '@/lib/supabase-server';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STORTINGET_DISCLAIMER =
  'Uoffisiell meningsmåling på Folkets Meninger. Ikke en avstemning i Stortinget.';

export default async function PollEmbedPage({ params, searchParams }: PageProps) {
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

  const options = parsePollEmbedOptions(query);

  const [totals, voteState, origin] = await Promise.all([
    getPollTotals(id),
    user ? getUserPollVote(user.id, id) : Promise.resolve({ hasVoted: false, vote: null }),
    resolveRequestShareOrigin(),
  ]);

  const shareUrl = buildPollShareUrl(id, origin);
  const votingOpen = isPollVotingOpen(poll);
  const compact = options.size === 'compact';
  const openOnSite = buildPollShareRelativePath(poll.id, { ref: 'embed' });

  return (
    <div lang="nb">
      <EmbedThemeController theme={options.theme} />
      <div className="bg-background p-3">
        <div
          className={cn(
            'mx-auto w-full max-w-xl space-y-4 bg-card',
            compact ? 'p-4' : 'p-5',
            options.border && 'border border-border',
          )}
          style={{ borderRadius: options.radius }}
        >
          <header className="flex items-center justify-between gap-3">
            <span className="text-sm font-extrabold tracking-tight text-brand">
              Folkets <span className="text-brand-accent">Meninger</span>
            </span>
            {!compact ? (
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Hva mener du?
              </span>
            ) : null}
          </header>

          <h1
            id="embed-poll-question"
            className="text-lg font-bold leading-snug text-foreground sm:text-xl"
          >
            {poll.title}
          </h1>
          {!compact && poll.neutralSummary ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {poll.neutralSummary.trim().slice(0, 240)}
            </p>
          ) : null}

          <SharePollWidget
            pollId={poll.id}
            title={poll.title}
            votingOpen={votingOpen}
            initialTotals={totals}
            initialVote={voteState.vote}
            shareUrl={shareUrl}
            variant="embed"
            size={options.size}
            refCode={options.ref}
            headingId="embed-poll-question"
          />

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {poll.track === 'system' ? SYSTEM_REEL_DISCLAIMER : STORTINGET_DISCLAIMER}
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {poll.stortingetIssueId ? (
              <Link
                href={routes.sak(poll.stortingetIssueId)}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-brand hover:underline"
              >
                Les saken på Folkets Meninger
              </Link>
            ) : null}
            <a
              href={openOnSite}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-brand hover:underline"
            >
              Åpne på Folkets Meninger
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
