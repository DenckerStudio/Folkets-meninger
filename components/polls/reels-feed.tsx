'use client';

import Link from 'next/link';
import { ChevronDown, ExternalLink, Info, Sparkles } from 'lucide-react';
import { PollBallot } from '@/components/polls/poll-ballot';
import { SYSTEM_REEL_DISCLAIMER, pollTrackLabel } from '@/lib/polls/labels';
import { isPollVotingOpen } from '@/lib/polls/format';
import type { PollChoice, PollRecord, PollTotals } from '@/lib/polls/types';
import { routes } from '@/lib/routes';

type ReelFeedItem = {
  poll: PollRecord;
  totals: PollTotals;
  userVote: PollChoice | null;
};

type ReelsFeedProps = {
  items: ReelFeedItem[];
};

export function ReelsFeed({ items }: ReelsFeedProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
        <p>{SYSTEM_REEL_DISCLAIMER}</p>
      </div>

      <div
        className="h-[min(34rem,calc(100dvh-16rem))] snap-y snap-mandatory overflow-y-auto rounded-2xl border border-border bg-card shadow-sm"
        aria-label="Systemgenererte reels"
      >
        {items.map(({ poll, totals, userVote }, index) => (
          <article
            key={poll.id}
            className="flex min-h-full snap-start flex-col justify-between gap-3 border-b border-border/60 p-4 last:border-b-0 sm:p-5"
          >
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide">
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-brand">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    {pollTrackLabel('system')}
                  </span>
                  <span className="text-muted-foreground">Ja / Nei / Blank</span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {index + 1} / {items.length}
                </span>
              </div>

              <h2 className="text-lg font-semibold leading-snug text-foreground sm:text-xl">
                {poll.title}
              </h2>

              {poll.neutralSummary ? (
                <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                  {poll.neutralSummary}
                </p>
              ) : null}

              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Kilder
                </p>
                <div className="mt-1.5 space-y-1.5">
                  {poll.stortingetIssueId ? (
                    <p className="text-sm text-foreground">
                      <Link
                        href={routes.sak(poll.stortingetIssueId)}
                        className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                      >
                        Stortingssak {poll.stortingetIssueId}
                      </Link>
                    </p>
                  ) : null}
                  {poll.sourceUrls.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {poll.sourceUrls.slice(0, 4).map((source) => (
                        <li key={source.url}>
                          <a
                            href={source.url}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
                            rel="noreferrer"
                            target="_blank"
                          >
                            {source.label || 'Dokument'}
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {!poll.stortingetIssueId && poll.sourceUrls.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Ingen kildelenker tilgjengelig.</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <PollBallot
                pollId={poll.id}
                votingOpen={isPollVotingOpen(poll)}
                initialTotals={totals}
                initialVote={userVote}
                loginNext={routes.avstemningerReels}
                compact
              />
              {index < items.length - 1 ? (
                <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  Bla for neste
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function ReelsFeedSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-14 rounded-xl bg-muted" />
      <div className="h-[min(34rem,calc(100dvh-16rem))] rounded-2xl border border-border bg-card p-5">
        <div className="space-y-3">
          <div className="h-5 w-32 rounded-full bg-muted" />
          <div className="h-8 w-4/5 rounded bg-muted" />
          <div className="h-20 rounded-lg bg-muted" />
          <div className="h-24 rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
