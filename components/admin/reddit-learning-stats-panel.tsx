'use client';

import { useMemo } from 'react';
import {
  REDDIT_LEARNING_STAT_DIMENSIONS,
  type RedditLearningStatDimension,
  type RedditLearningStatRow,
  type RedditLearningStatsResponse,
} from '@/lib/reddit-signals/cluster-types';
import { REDDIT_LEARNING_DIMENSION_LABELS } from '@/lib/reddit-signals/cluster-labels';
import { cn } from '@/lib/utils';

const tableClass = 'w-full min-w-[640px] border-collapse text-sm';
const thClass =
  'border-b border-border px-3 py-2 text-left text-xs font-semibold text-muted-foreground';
const tdClass = 'border-b border-border px-3 py-3 align-top text-foreground';

function formatPercent(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return '—';
  return `${(rate * 100).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} %`;
}

function groupByDimension(
  rows: RedditLearningStatRow[],
): Record<RedditLearningStatDimension, RedditLearningStatRow[]> {
  const out = {
    subreddit: [],
    topic: [],
    link_domain: [],
  } as Record<RedditLearningStatDimension, RedditLearningStatRow[]>;
  for (const row of rows) {
    out[row.dimension].push(row);
  }
  for (const dim of REDDIT_LEARNING_STAT_DIMENSIONS) {
    out[dim].sort((a, b) => b.total - a.total);
  }
  return out;
}

function DimensionTable({
  dimension,
  rows,
}: {
  dimension: RedditLearningStatDimension;
  rows: RedditLearningStatRow[];
}) {
  const title = REDDIT_LEARNING_DIMENSION_LABELS[dimension];
  return (
    <section aria-labelledby={`learning-stats-${dimension}`} className="space-y-0">
      <h3 id={`learning-stats-${dimension}`} className="px-1 text-sm font-semibold text-foreground">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">
          Ingen grupper med minst 5 signaler for {title.toLowerCase()}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className={tableClass}>
            <caption className="sr-only">
              Brukt-rate per {title.toLowerCase()}, bare grupper med minst fem signaler
            </caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>
                  {title}
                </th>
                <th scope="col" className={cn(thClass, 'tabular-nums')}>
                  Antall (n)
                </th>
                <th scope="col" className={cn(thClass, 'tabular-nums')}>
                  Brukt-rate
                </th>
                <th scope="col" className={cn(thClass, 'tabular-nums')}>
                  Brukt
                </th>
                <th scope="col" className={cn(thClass, 'tabular-nums')}>
                  Ignorert
                </th>
                <th scope="col" className={cn(thClass, 'tabular-nums')}>
                  Snitt relevans
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${dimension}-${row.groupKey}`}>
                  <th scope="row" className={cn(tdClass, 'font-medium')}>
                    {row.groupKey}
                  </th>
                  <td className={cn(tdClass, 'tabular-nums')}>{row.total.toLocaleString('nb-NO')}</td>
                  <td className={cn(tdClass, 'tabular-nums font-medium text-brand')}>
                    {formatPercent(row.bruktRate)}
                  </td>
                  <td className={cn(tdClass, 'tabular-nums')}>{row.brukt.toLocaleString('nb-NO')}</td>
                  <td className={cn(tdClass, 'tabular-nums')}>
                    {(row.ignorert + row.autoIgnorert).toLocaleString('nb-NO')}
                  </td>
                  <td className={cn(tdClass, 'tabular-nums')}>
                    {row.avgAiRelevance === null ? '—' : row.avgAiRelevance.toLocaleString('nb-NO')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RedditLearningStatsPanel({ data }: { data: RedditLearningStatsResponse }) {
  const grouped = useMemo(() => groupByDimension(data.rows), [data.rows]);

  if (data.viewMissing) {
    return (
      <section
        className="rounded-xl border border-border bg-card p-4"
        aria-labelledby="reddit-learning-stats-heading"
      >
        <h2 id="reddit-learning-stats-heading" className="text-sm font-semibold text-foreground">
          Brukt-rate (n ≥ 5)
        </h2>
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {data.viewMissingMessage ?? 'Statistikk er ikke tilgjengelig.'}
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-border bg-card p-4 space-y-6"
      aria-labelledby="reddit-learning-stats-heading"
    >
      <div>
        <h2 id="reddit-learning-stats-heading" className="text-sm font-semibold text-foreground">
          Brukt-rate (n ≥ 5)
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Andel signaler markert som brukt, inkludert kobling via research-tema. Kun grupper med minst
          fem signaler vises.
        </p>
      </div>
      <div className="grid gap-8 xl:grid-cols-1">
        {REDDIT_LEARNING_STAT_DIMENSIONS.map((dimension) => (
          <DimensionTable key={dimension} dimension={dimension} rows={grouped[dimension]} />
        ))}
      </div>
    </section>
  );
}