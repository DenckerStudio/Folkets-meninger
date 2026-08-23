'use client';

import Link from 'next/link';
import { PollBallot } from '@/components/polls/poll-ballot';
import { pollTrackLabel } from '@/lib/polls/labels';
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
  return (
    <div
      className="h-[min(38rem,calc(100dvh-14rem))] snap-y snap-mandatory overflow-y-auto rounded-2xl border border-border"
      aria-label="Systemgenererte reels"
    >
      {items.map(({ poll, totals, userVote }) => (
        <article
          key={poll.id}
          className="flex h-full snap-start flex-col justify-between gap-4 bg-card p-5 sm:p-6"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-brand">
                {pollTrackLabel('system')}
              </span>
              <span className="text-muted-foreground">Ja / Nei / Blank</span>
            </div>
            <h2 className="text-xl font-semibold leading-snug text-foreground sm:text-2xl">
              {poll.title}
            </h2>
            {poll.neutralSummary ? (
              <p className="line-clamp-5 text-sm leading-relaxed text-muted-foreground">
                {poll.neutralSummary}
              </p>
            ) : null}
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
              <ul className="flex flex-wrap gap-2">
                {poll.sourceUrls.slice(0, 3).map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      className="inline-flex rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-brand/40 hover:text-foreground"
                      rel="noreferrer"
                      target="_blank"
                    >
                      {source.label || 'Kilde'}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <PollBallot
            pollId={poll.id}
            votingOpen={isPollVotingOpen(poll)}
            initialTotals={totals}
            initialVote={userVote}
            loginNext={routes.avstemningerReels}
            compact
          />
        </article>
      ))}
    </div>
  );
}
