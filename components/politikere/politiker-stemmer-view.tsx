'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, Scale, Users } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { POLL_BALLOT_CHOICES, pollChoiceLabel } from '@/lib/polls/labels';
import { POLL_BALLOT_RESULT_BAR_CLASS } from '@/lib/polls/ballot-buttons';
import type { PolitikerStemmerBundle, PolitikerStemmerRow } from '@/lib/politiker-profile-stemmer-model';
import {
  formatPartyLineLabel,
  formatRepresentantStortingetVoteLabel,
} from '@/lib/politiker-profile-stemmer-model';
import { publicPollPercentsNullable, type PublicPollTotals } from '@/lib/public-aggregate/poll-public-output';
import type { PollChoice, PollTotals } from '@/lib/polls/types';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';

type PolitikerStemmerViewProps = {
  repId: string;
  repName: string;
  bundle: PolitikerStemmerBundle;
};

function toPollTotals(publicTotals: PublicPollTotals): PollTotals {
  return {
    ja: publicTotals.ja ?? 0,
    nei: publicTotals.nei ?? 0,
    blank: publicTotals.blank ?? 0,
    total: publicTotals.total,
  };
}

function PollAggregateBars({
  title,
  totals,
  className,
}: {
  title: string;
  totals: PublicPollTotals;
  className?: string;
}) {
  const showBreakdown = totals.ja != null && totals.nei != null && totals.blank != null;
  if (!showBreakdown) return null;

  const percents = publicPollPercentsNullable(toPollTotals(totals));

  return (
    <div className={cn('rounded-xl border border-border bg-muted/30 p-3', className)}>
      <p className="text-xs font-semibold text-foreground mb-2">{title}</p>
      <div className="space-y-2">
        {POLL_BALLOT_CHOICES.map((choice: PollChoice) => {
          const pct = percents[choice];
          if (pct == null) return null;
          return (
            <div key={choice}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-foreground">{pollChoiceLabel(choice)}</span>
                <span className="text-muted-foreground">{pct} %</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', POLL_BALLOT_RESULT_BAR_CLASS[choice])}
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FolkemeningBelowThreshold({
  pollOpen,
  pollHref,
}: {
  pollOpen: boolean;
  pollHref: string | null;
}) {
  if (pollOpen && pollHref) {
    return (
      <p className="text-sm text-muted-foreground">
        For få svar ennå til å vise fordeling.{' '}
        <Link
          href={pollHref}
          className="font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-sm"
        >
          Gå til avstemningen
        </Link>
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Det kom ikke nok svar til å vise fordeling.
    </p>
  );
}

function StemRowCard({ row }: { row: PolitikerStemmerRow }) {
  const showPublicPollTotals = row.pollTotalsPublic?.ja != null;

  return (
    <article className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <div>
            <Link
              href={row.sakHref}
              className="font-semibold text-foreground line-clamp-2 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-sm"
            >
              {row.sakTitle}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{row.voteringTema}</p>
            {row.votedAtLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">Votering: {row.votedAtLabel}</p>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Representanten</p>
              <p className="text-sm font-semibold text-foreground">
                {formatRepresentantStortingetVoteLabel(row.representantVote)}
              </p>
            </div>
            <div
              className={cn(
                'rounded-xl border px-3 py-2',
                row.votedAgainstParty
                  ? 'border-destructive/40 bg-destructive/10'
                  : 'border-border bg-muted/40',
              )}
            >
              <p className="text-xs text-muted-foreground">Partilinje</p>
              <p className="text-sm font-semibold text-foreground">
                {formatPartyLineLabel(row.partyLine)}
              </p>
              {row.votedAgainstParty ? (
                <p className="mt-1 text-xs font-medium text-destructive">Stemte mot eget parti</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4 text-brand" aria-hidden />
            Folkemening (anonymt)
          </div>

          {row.poll && row.pollTotalsPublic ? (
            <>
              {showPublicPollTotals ? (
                <PollAggregateBars title="Nasjonalt" totals={row.pollTotalsPublic} />
              ) : null}
              {showPublicPollTotals && row.pollFylkeTotalsPublic && row.pollFylkeName ? (
                <PollAggregateBars
                  title={row.pollFylkeName}
                  totals={row.pollFylkeTotalsPublic}
                />
              ) : null}
              {!showPublicPollTotals ? (
                <FolkemeningBelowThreshold pollOpen={row.pollOpen} pollHref={row.pollHref} />
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground rounded-xl border border-border bg-muted/30 p-3">
              Ingen offentlig Nei/Blank/Ja-avstemning er knyttet til denne saken ennå.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function PolitikerStemmerErrorActions({ repId }: { repId: string }) {
  const router = useRouter();
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => router.refresh()}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        Prøv igjen
      </button>
      <Link
        href={routes.politiker(repId)}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        Tilbake til oversikt
      </Link>
    </div>
  );
}

export function PolitikerStemmerView({ repId, repName, bundle }: PolitikerStemmerViewProps) {
  if (bundle.status === 'error') {
    return (
      <div
        className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:p-6"
        role="alert"
      >
        <p className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {bundle.errorMessage}
        </p>
        <PolitikerStemmerErrorActions repId={repId} />
      </div>
    );
  }

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-foreground">
          <Scale className="h-5 w-5 text-brand" aria-hidden />
          Stemmer og folkemening
        </h2>
        <p className="text-sm text-muted-foreground">
          Siste voteringer fra Stortinget sammen med anonyme avstemninger på Folkets Meninger, der
          det finnes tilstrekkelig data.
        </p>
      </div>

      {bundle.status !== 'empty' && bundle.rows.length > 0 ? (
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm text-foreground">
          {bundle.summary.message}
        </div>
      ) : null}

      {bundle.status === 'empty' || bundle.rows.length === 0 ? (
        <EmptyState
          compact
          title="Ingen voteringer å vise ennå"
          description={`Vi fant ingen voteringer der ${repName} har stemt på saker vi følger ennå.`}
        />
      ) : (
        <div className="space-y-4">
          {bundle.rows.map((row) => (
            <StemRowCard key={`${row.issueId}-${row.voteringId}`} row={row} />
          ))}
        </div>
      )}

      <div className="border-t border-border pt-4">
        <Link
          href={routes.avstemninger}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-sm"
        >
          Se alle avstemninger
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}