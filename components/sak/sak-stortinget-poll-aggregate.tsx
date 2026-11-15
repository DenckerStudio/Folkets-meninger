import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { PollChoiceResultTiles } from '@/components/polls/poll-choice-result-tiles';
import { NonRepresentativeNotice } from '@/components/trust/non-representative-notice';
import { findPublicPollForIssue, getPollTotals } from '@/lib/polls/service';
import {
  POLL_PUBLIC_AGGREGATE_BELOW_THRESHOLD_LABEL,
} from '@/lib/public-aggregate/poll-public-output';
import { publicAggregateMeetsThreshold } from '@/lib/public-aggregate/threshold';
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

  const showBreakdown = publicAggregateMeetsThreshold(totals.total);

  return (
    <section
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
      aria-labelledby="sak-poll-aggregate-heading"
    >
      <p className="sr-only" id="sak-poll-aggregate-heading">
        Avstemningsresultat på Folkets Meninger
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
      {showBreakdown ? (
        <>
          <PollChoiceResultTiles totals={totals} className="mt-4" />
          <NonRepresentativeNotice
            count={totals.total}
            countLabel="stemmer"
            countLabelSingular="stemme"
            className="mt-3"
          />
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {POLL_PUBLIC_AGGREGATE_BELOW_THRESHOLD_LABEL}
          {totals.total > 0 ? ` (${totals.total} stemmer registrert).` : '.'}
        </p>
      )}
    </section>
  );
}