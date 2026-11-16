'use client';

import Link from 'next/link';
import { ExternalLink, Scale } from 'lucide-react';
import type { SakFolkVsStortingetViewModel } from '@/lib/sak/folk-vs-stortinget-view';
import { formatStemmerCount } from '@/lib/norwegian-plural';
import { cn } from '@/lib/utils';

function SplitBar({
  segments,
}: {
  segments: { label: string; percent: number; barClass: string }[];
}) {
  return (
    <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
      {segments
        .filter((segment) => segment.percent > 0)
        .map((segment) => (
          <div
            key={segment.label}
            className={cn('h-full', segment.barClass)}
            style={{ width: `${segment.percent}%` }}
          />
        ))}
    </div>
  );
}

export function SakFolketsViljeVsStortinget({
  sakId,
  model,
}: {
  sakId: string;
  model: SakFolkVsStortingetViewModel;
}) {
  return (
    <section
      id="sak-folk-vs-stortinget"
      data-sak-folk-vs-stortinget=""
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-8"
    >
      <h2 className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl">
        <Scale className="h-6 w-6 text-brand" aria-hidden />
        Folkets vilje vs. Stortinget
      </h2>

      {model.emptyMessage ? (
        <p className="mt-3 text-sm text-muted-foreground">{model.emptyMessage}</p>
      ) : (
        <div className="mt-4 space-y-6">
          {model.headline ? (
            <p className="text-base font-semibold leading-relaxed text-foreground">{model.headline}</p>
          ) : null}
          {model.summary ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{model.summary}</p>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Stortinget</h3>
              {model.stortingetForPercent != null && model.stortingetAgainstPercent != null ? (
                <>
                  <SplitBar
                    segments={[
                      {
                        label: 'for',
                        percent: model.stortingetForPercent,
                        barClass: 'bg-emerald-500',
                      },
                      {
                        label: 'mot',
                        percent: model.stortingetAgainstPercent,
                        barClass: 'bg-brand-accent',
                      },
                    ]}
                  />
                  <StortingLegend
                    forLabel={model.stortingetBarFor}
                    forPercent={model.stortingetForPercent}
                    againstLabel={model.stortingetBarAgainst}
                    againstPercent={model.stortingetAgainstPercent}
                    absent={model.stortingetAbsentLabel}
                  />
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Ingen votering er registrert hos Stortinget for denne saken ennå.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Folket i appen</h3>
              {model.showFolkDistribution ? (
                model.folkKind === 'poll' && model.pollPercents && model.pollTotals ? (
                  <>
                    <SplitBar
                      segments={[
                        { label: 'nei', percent: model.pollPercents.nei, barClass: 'bg-brand-accent' },
                        { label: 'blank', percent: model.pollPercents.blank, barClass: 'bg-muted-foreground/35' },
                        { label: 'ja', percent: model.pollPercents.ja, barClass: 'bg-brand' },
                      ]}
                    />
                    <PollLegend
                      rows={[
                        { label: 'Nei', value: model.pollPercents.nei, className: 'text-brand-accent' },
                        { label: 'Blank', value: model.pollPercents.blank, className: 'text-muted-foreground' },
                        { label: 'Ja', value: model.pollPercents.ja, className: 'text-brand' },
                      ]}
                      total={model.pollTotals.total}
                    />
                  </>
                ) : (
                  <>
                    <SplitBar
                      segments={[
                        { label: 'for', percent: model.historicForPercent, barClass: 'bg-emerald-500' },
                        { label: 'mot', percent: model.historicAgainstPercent, barClass: 'bg-brand-accent' },
                        { label: 'avstår', percent: model.historicAbstainPercent, barClass: 'bg-muted-foreground/35' },
                      ]}
                    />
                    <PollLegend
                      rows={[
                        { label: 'For', value: model.historicForPercent, className: 'text-emerald-700 dark:text-emerald-300' },
                        { label: 'Mot', value: model.historicAgainstPercent, className: 'text-brand-accent' },
                        { label: 'Avstår', value: model.historicAbstainPercent, className: 'text-muted-foreground' },
                      ]}
                      total={model.historicFolk.total}
                      note="Historiske anonyme stemmer før dagens Nei/Blank/Ja-avstemning."
                    />
                  </>
                )
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {model.folkHiddenMessage ?? 'Ingen offentlig fordeling å vise ennå.'}
                </p>
              )}
            </div>
          </div>

          {model.voteringTema ? (
            <p className="text-xs text-muted-foreground">Voteringstema: {model.voteringTema}</p>
          ) : null}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-4 text-sm">
        {model.pollHref ? (
          <Link
            href={model.pollHref}
            className="inline-flex min-h-11 items-center rounded-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            {model.votingOpen ? 'Stem i avstemningen' : 'Se avstemningen'}
          </Link>
        ) : null}
        <a
          href={`https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=${sakId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-sm font-medium text-muted-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden />
          Stortingets sakside
        </a>
      </div>
    </section>
  );
}

function PollLegend({
  rows,
  total,
  note,
}: {
  rows: { label: string; value: number; className: string }[];
  total: number;
  note?: string;
}) {
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs font-medium">
        {rows.map((row) => (
          <span key={row.label} className={cn(row.className)}>
            {row.label} {row.value}%
          </span>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatStemmerCount(total)}
        {note ? ` · ${note}` : ''}
      </p>
    </>
  );
}

function StortingLegend({
  forLabel,
  forPercent,
  againstLabel,
  againstPercent,
  absent,
}: {
  forLabel: string;
  forPercent: number;
  againstLabel: string;
  againstPercent: number;
  absent: string | null;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs font-medium">
      <span className="text-emerald-700 dark:text-emerald-300">
        {forLabel} {forPercent}%
      </span>
      {absent ? <span className="text-center text-muted-foreground">{absent}</span> : null}
      <span className="text-brand-accent">
        {againstLabel} {againstPercent}%
      </span>
    </div>
  );
}