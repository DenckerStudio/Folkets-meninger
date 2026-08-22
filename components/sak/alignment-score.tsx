'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Scale, ExternalLink } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { SAK_META_TOOLTIPS } from '@/lib/stortinget-sak-tooltips';
import { useSakTooltipsEnabled } from '@/components/theme-provider';
import { buildAlignmentComparison } from '@/lib/alignment/score';
import {
  ALIGNMENT_MIN_FOLK_VOTES,
  type AlignmentVerdict,
  type FolkVoteCounts,
  type SakVotering,
} from '@/lib/alignment/types';
import { cn } from '@/lib/utils';

function verdictCopy(verdict: AlignmentVerdict): { label: string; className: string } {
  switch (verdict) {
    case 'aligned':
      return {
        label: 'I tråd med folket',
        className: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/50',
      };
    case 'partial':
      return {
        label: 'Delvis avvik',
        className: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/50',
      };
    case 'divergent':
      return {
        label: 'Stor avstand',
        className: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900/50',
      };
    case 'pending':
      return {
        label: 'Venter på votering',
        className: 'bg-muted text-muted-foreground ring-border',
      };
    case 'insufficient':
      return {
        label: 'For få folkestemmer',
        className: 'bg-muted text-muted-foreground ring-border',
      };
    default: {
      const _exhaustive: never = verdict;
      return _exhaustive;
    }
  }
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const stroke = 8;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - Math.min(100, Math.max(0, score)) / 100);
  const tone =
    score >= 70 ? 'stroke-emerald-500' : score >= 40 ? 'stroke-amber-500' : 'stroke-rose-500';

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90" aria-hidden>
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          className={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-foreground">{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">samsvar</span>
      </div>
    </div>
  );
}

function SplitBar({
  forPercent,
  againstPercent,
  restPercent,
  restLabel,
}: {
  forPercent: number;
  againstPercent: number;
  restPercent: number;
  restLabel: string;
}) {
  return (
    <div className="h-3.5 overflow-hidden rounded-full bg-muted shadow-inner">
      <div className="flex h-full w-full">
        <div
          className="bg-emerald-500"
          style={{ width: `${forPercent}%` }}
          title={`For: ${forPercent}%`}
        />
        <div
          className="bg-rose-500"
          style={{ width: `${againstPercent}%` }}
          title={`Mot: ${againstPercent}%`}
        />
        <div
          className="bg-muted-foreground/40"
          style={{ width: `${restPercent}%` }}
          title={`${restLabel}: ${restPercent}%`}
        />
      </div>
    </div>
  );
}

export function AlignmentScore({
  sakId,
  voteringer,
  initialFolk,
}: {
  sakId: string;
  voteringer: SakVotering[];
  initialFolk: FolkVoteCounts;
}) {
  const showTooltips = useSakTooltipsEnabled();
  const mounted = useIsClient();
  const [folk, setFolk] = useState<FolkVoteCounts>(initialFolk);
  const comparison = useMemo(
    () => buildAlignmentComparison(folk, voteringer),
    [folk, voteringer],
  );
  const badge = verdictCopy(comparison.verdict);

  useEffect(() => {
    let cancelled = false;
    async function refreshFolk() {
      try {
        const res = await fetch(`/api/vote?issueId=${encodeURIComponent(sakId)}`);
        const data = await res.json();
        if (cancelled) return;
        const forCount = data.for ?? 0;
        const against = data.against ?? 0;
        const abstain = data.abstain ?? 0;
        setFolk({
          for: forCount,
          against,
          abstain,
          total: data.total ?? forCount + against + abstain,
        });
      } catch {
        // Keep server-rendered totals
      }
    }
    void refreshFolk();
    return () => {
      cancelled = true;
    };
  }, [sakId]);

  const chartData = useMemo(() => {
    const stFor = comparison.stortingetForPercent ?? 0;
    const stAgainst = comparison.stortingetAgainstPercent ?? 0;
    return [
      { name: 'For', Folket: comparison.folkForPercent, Stortinget: stFor },
      { name: 'Mot', Folket: comparison.folkAgainstPercent, Stortinget: stAgainst },
    ];
  }, [comparison]);

  const stAbsentPercent =
    comparison.stortinget && comparison.stortinget.for + comparison.stortinget.against + comparison.stortinget.absent > 0
      ? Math.round(
          (comparison.stortinget.absent /
            (comparison.stortinget.for + comparison.stortinget.against + comparison.stortinget.absent)) *
            100,
        )
      : 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl">
          <Scale className="h-6 w-6 text-brand" aria-hidden />
          Folkets vilje vs. Stortinget
          {showTooltips ? (
            <InfoTooltip
              label="samsvars-scoren"
              description={SAK_META_TOOLTIPS.samsvarsScore}
              side="bottom"
            />
          ) : null}
        </h2>
        <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1', badge.className)}>
          {badge.label}
        </span>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {comparison.score != null ? <ScoreRing score={comparison.score} /> : null}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-base font-semibold leading-relaxed text-foreground">{comparison.headline}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{comparison.summary}</p>
        </div>
      </div>

      {comparison.verdict !== 'pending' ? (
        <div className="mt-6 h-56 w-full">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, '']}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                  }}
                />
                <Legend />
                <Bar dataKey="Folket" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={42} />
                <Bar dataKey="Stortinget" fill="#00205b" radius={[4, 4, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full animate-pulse rounded-xl bg-muted/40" />
          )}
        </div>
      ) : null}

      <div className="mt-6 space-y-5">
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Folket i appen</h3>
            <span className="text-xs text-muted-foreground">{comparison.folk.total} stemmer</span>
          </div>
          {comparison.folk.total > 0 ? (
            <>
              <SplitBar
                forPercent={comparison.folkForPercent}
                againstPercent={comparison.folkAgainstPercent}
                restPercent={comparison.folkAbstainPercent}
                restLabel="Avstår"
              />
              <div className="mt-2 flex justify-between text-xs font-medium text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400">For {comparison.folkForPercent}%</span>
                <span>Avstår {comparison.folkAbstainPercent}%</span>
                <span className="text-rose-600 dark:text-rose-400">Mot {comparison.folkAgainstPercent}%</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Ingen har stemt i appen ennå.</p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Stortinget</h3>
            {comparison.stortinget ? (
              <span className="text-xs text-muted-foreground">
                {comparison.stortinget.decided} avgitte stemmer
              </span>
            ) : null}
          </div>
          {comparison.stortinget && comparison.stortingetForPercent != null ? (
            <>
              <SplitBar
                forPercent={comparison.stortingetForPercent}
                againstPercent={comparison.stortingetAgainstPercent ?? 0}
                restPercent={stAbsentPercent}
                restLabel="Ikke til stede"
              />
              <div className="mt-2 flex justify-between text-xs font-medium text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400">
                  For {comparison.stortingetForPercent}%
                </span>
                <span>Ikke til stede {stAbsentPercent}%</span>
                <span className="text-rose-600 dark:text-rose-400">
                  Mot {comparison.stortingetAgainstPercent}%
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ingen votering er registrert hos Stortinget for denne saken ennå.
            </p>
          )}
        </div>
      </div>

      {comparison.votering?.votering_tema ? (
        <p className="mt-5 text-xs text-muted-foreground">
          Voteringstema: {comparison.votering.votering_tema}
          {comparison.otherVoteringCount > 0
            ? ` · ${comparison.otherVoteringCount} andre voteringer i saken`
            : null}
        </p>
      ) : null}

      {comparison.verdict === 'insufficient' ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Samsvars-score vises når minst {ALIGNMENT_MIN_FOLK_VOTES} anonyme stemmer er avgitt.
        </p>
      ) : null}

      <a
        href={`https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=${sakId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        <ExternalLink className="mr-1.5 h-4 w-4" />
        Se saken på stortinget.no
      </a>
    </section>
  );
}
