'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Loader2, Radar } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { RedditSignalSparkline } from '@/components/admin/reddit-signal-sparkline';
import {
  RedditSpikeActiveRowMark,
  RedditSpikeBadgePanel,
} from '@/components/admin/reddit-spike-badge-panel';
import { ResearchViewTabs } from '@/components/admin/research-view-tabs';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/dashboard/empty-state';
import type { RedditSignalSubreddit } from '@/lib/admin/oppfanget/types';
import {
  REDDIT_SIGNAL_SORT_KEYS,
  REDDIT_SIGNAL_STATUSES,
  type RedditSignalApiAction,
  type RedditSignalListFilters,
  type RedditSignalListResponse,
  type RedditSignalAdminRow,
} from '@/lib/reddit-signals/types';
import { buildRedditSignalsAdminPath } from '@/lib/reddit-signals/query';
import {
  rowIsListedInSpikeBadge,
  type RedditSpikeBadgeView,
} from '@/lib/reddit-signals/spike-badge';
import {
  REDDIT_SIGNAL_ACTION_LABELS,
  REDDIT_SIGNAL_BLOKKER_CONFIRM,
  REDDIT_SIGNAL_SORT_LABELS,
  REDDIT_SIGNAL_STATUS_LABELS,
} from '@/lib/reddit-signals/labels';
import { RedditSubredditBadge, formatRedditContention } from '@/lib/reddit-signals/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const SUBREDDIT_OPTIONS: { value: '' | RedditSignalSubreddit; label: string }[] = [
  { value: '', label: 'Alle subreddits' },
  { value: 'norge', label: 'r/norge' },
  { value: 'norske', label: 'r/norske' },
  { value: 'Nordmenn', label: 'r/Nordmenn' },
];

const chipClass =
  'inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-foreground';

const fieldClass =
  'min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const labelClass = 'text-xs font-medium text-muted-foreground';

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <span className={chipClass} title={label}>
      <span className="sr-only">{label}: </span>
      {value}
    </span>
  );
}

function StatusBadge({ status }: { status: RedditSignalAdminRow['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
        status === 'blokkert' && 'bg-destructive/10 text-destructive',
        status === 'ignorert' && 'bg-muted text-muted-foreground',
        status === 'auto_ignorert' && 'bg-muted text-muted-foreground',
        status === 'brukt' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        status === 'ny' && 'bg-brand/10 text-brand',
      )}
    >
      {REDDIT_SIGNAL_STATUS_LABELS[status]}
    </span>
  );
}

function formatRatio(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '—';
  return `${Math.round(ratio * 100)} %`;
}

function RedditSignalRowActions({
  row,
  onUpdated,
}: {
  row: RedditSignalAdminRow;
  onUpdated: () => void;
}) {
  const [pending, setPending] = useState<RedditSignalApiAction | null>(null);
  const [error, setError] = useState('');
  const [reasonOpen, setReasonOpen] = useState<RedditSignalApiAction | null>(null);
  const [blokkerConfirm, setBlokkerConfirm] = useState(false);
  const [reason, setReason] = useState('');

  const runAction = useCallback(
    async (action: RedditSignalApiAction, body: { reason?: string }) => {
      setPending(action);
      setError('');
      try {
        const res = await fetch(
          `/api/admin/reddit-signals/${encodeURIComponent(row.id)}/${action}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );
        const json = (await res.json().catch(() => ({}))) as { message?: string };
        if (!res.ok) {
          setError(json.message ?? 'Handlingen feilet');
          return;
        }
        setReasonOpen(null);
        setBlokkerConfirm(false);
        setReason('');
        onUpdated();
      } catch {
        setError('Handlingen feilet');
      } finally {
        setPending(null);
      }
    },
    [onUpdated, row.id],
  );

  const disabled = pending !== null || row.status === 'blokkert';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setReasonOpen('ignorer')}
          className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {pending === 'ignorer' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Ignorer
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setBlokkerConfirm(true)}
          className="inline-flex min-h-11 items-center rounded-lg border border-destructive/40 bg-card px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          {pending === 'blokker' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Blokker permanent
        </button>
        <button
          type="button"
          disabled={disabled || row.status === 'brukt'}
          onClick={() => runAction('marker_brukt', {})}
          className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {pending === 'marker_brukt' ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : null}
          Marker brukt
        </button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Dialog
        open={reasonOpen === 'ignorer'}
        onClose={() => {
          if (pending === null) setReasonOpen(null);
        }}
        title="Ignorer signal"
        description="Oppgi hvorfor signalet skal ignoreres. Dette logges internt."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm"
              onClick={() => setReasonOpen(null)}
              disabled={pending !== null}
            >
              Avbryt
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground"
              disabled={pending !== null}
              onClick={() => runAction('ignorer', { reason })}
            >
              Lagre
            </button>
          </div>
        }
      >
        <label className="block text-sm">
          <span className={labelClass}>Begrunnelse</span>
          <textarea
            className={cn(fieldClass, 'mt-1 min-h-[88px]')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </Dialog>

      <Dialog
        open={blokkerConfirm}
        onClose={() => {
          if (pending === null) setBlokkerConfirm(false);
        }}
        title="Blokker permanent?"
        description={REDDIT_SIGNAL_BLOKKER_CONFIRM}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm"
              onClick={() => setBlokkerConfirm(false)}
              disabled={pending !== null}
            >
              Avbryt
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground"
              disabled={pending !== null}
              onClick={() => setReasonOpen('blokker')}
            >
              Fortsett
            </button>
          </div>
        }
      >
        <span className="sr-only">Bekreft blokkering</span>
      </Dialog>

      <Dialog
        open={reasonOpen === 'blokker'}
        onClose={() => {
          if (pending === null) setReasonOpen(null);
        }}
        title="Begrunnelse for blokkering"
        description="Oppgi kort hvorfor dette signalet skal blokkeres permanent."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm"
              onClick={() => setReasonOpen(null)}
              disabled={pending !== null}
            >
              Avbryt
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground"
              disabled={pending !== null}
              onClick={() => runAction('blokker', { reason })}
            >
              Blokker
            </button>
          </div>
        }
      >
        <label className="block text-sm">
          <span className={labelClass}>Begrunnelse</span>
          <textarea
            className={cn(fieldClass, 'mt-1 min-h-[88px]')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </Dialog>
    </div>
  );
}

function RedditSignalRow({
  row,
  onUpdated,
  spikeHighlight,
}: {
  row: RedditSignalAdminRow;
  onUpdated: () => void;
  spikeHighlight: boolean;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <RedditSubredditBadge subreddit={row.subreddit} />
            <StatusBadge status={row.status} />
            {spikeHighlight ? <RedditSpikeActiveRowMark /> : null}
            {row.flair ? <span className={chipClass}>{row.flair}</span> : null}
          </div>
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 max-w-full items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            <span className="line-clamp-2">{row.title}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>
          {row.topic ? (
            <p className="text-xs text-muted-foreground">
              Tema: <span className="text-foreground">{row.topic}</span>
            </p>
          ) : null}
          {row.aiRelevance !== null ? (
            <p className="text-xs text-muted-foreground">
              Relevans:{' '}
              <span className="font-medium tabular-nums text-foreground">{row.aiRelevance}/5</span>
              {row.aiReason ? ` — ${row.aiReason}` : null}
            </p>
          ) : null}
        </div>
        <RedditSignalSparkline snapshots={row.snapshots} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <MetricChip label="Poeng" value={row.score.toLocaleString('nb-NO')} />
        <MetricChip label="Upvote-andel" value={formatRatio(row.upvoteRatio)} />
        <MetricChip label="Kommentarer" value={row.numComments.toLocaleString('nb-NO')} />
        <MetricChip
          label="Kryssposter"
          value={(row.numCrossposts ?? 0).toLocaleString('nb-NO')}
        />
        <MetricChip
          label="Kommentarer per poeng"
          value={formatRedditContention(row.contention)}
        />
        <MetricChip
          label="Engasjement"
          value={row.engagement.toLocaleString('nb-NO')}
        />
        <MetricChip
          label="Vekst 24 t"
          value={
            row.growth24h === null
              ? '—'
              : `${row.growth24h >= 0 ? '+' : ''}${row.growth24h.toLocaleString('nb-NO')}`
          }
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {row.stortingetIssueId ? (
          <Link href={routes.sak(row.stortingetIssueId)} className="min-h-11 text-brand hover:underline">
            {row.relatedIssueTitle ?? `Sak ${row.stortingetIssueId}`}
          </Link>
        ) : (
          <span>Ingen sak koblet</span>
        )}
        {row.removalType ? <span>Fjernet ({row.removalType})</span> : null}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <RedditSignalRowActions row={row} onUpdated={onUpdated} />
      </div>
    </article>
  );
}

export default function RedditSignalsClient({
  initialData,
  initialFilters,
  devPreview,
  spikeBadge,
}: {
  initialData: RedditSignalListResponse;
  initialFilters: RedditSignalListFilters;
  devPreview?: string;
  spikeBadge: RedditSpikeBadgeView | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const urlSyncReadyRef = useRef(false);

  const [subreddit, setSubreddit] = useState(initialFilters.subreddit);
  const [topic, setTopic] = useState(initialFilters.topic);
  const [minScore, setMinScore] = useState(
    initialFilters.minScore !== null ? String(initialFilters.minScore) : '',
  );
  const [minComments, setMinComments] = useState(
    initialFilters.minComments !== null ? String(initialFilters.minComments) : '',
  );
  const [minRelevance, setMinRelevance] = useState(
    initialFilters.minRelevance !== null ? String(initialFilters.minRelevance) : '',
  );
  const [status, setStatus] = useState(initialFilters.status);
  const [hideRemoved, setHideRemoved] = useState(initialFilters.hideRemoved);
  const [onlySak, setOnlySak] = useState(initialFilters.onlyWithSakLink);
  const [sort, setSort] = useState(initialFilters.sort);
  const [spikeFocus, setSpikeFocus] = useState(initialFilters.spikeFocus);

  useEffect(() => {
    setSpikeFocus(initialFilters.spikeFocus);
  }, [initialFilters.spikeFocus]);

  const spikeBadgeActive = spikeBadge !== null && spikeBadge.items.length > 0;

  const filters = useMemo<RedditSignalListFilters>(() => {
    const parseNum = (s: string) => {
      const t = s.trim();
      if (!t) return null;
      const n = Number.parseInt(t, 10);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    return {
      subreddit,
      topic: topic.trim(),
      minScore: parseNum(minScore),
      minComments: parseNum(minComments),
      minRelevance: parseNum(minRelevance),
      status,
      hideRemoved,
      onlyWithSakLink: onlySak,
      spikeFocus,
      sort,
    };
  }, [
    subreddit,
    topic,
    minScore,
    minComments,
    minRelevance,
    status,
    hideRemoved,
    onlySak,
    spikeFocus,
    sort,
  ]);

  const previewParam = devPreview === 'fixture' ? 'fixture' : null;

  useEffect(() => {
    const path = buildRedditSignalsAdminPath(filters, previewParam);
    if (!urlSyncReadyRef.current) {
      urlSyncReadyRef.current = true;
      if (typeof window !== 'undefined') {
        const current = window.location.pathname + window.location.search;
        if (path === current) return;
      }
    }
    router.replace(path, { scroll: false });
  }, [filters, previewParam, router]);

  const clearFilters = () => {
    setSubreddit('');
    setTopic('');
    setMinScore('');
    setMinComments('');
    setMinRelevance('');
    setStatus('');
    setHideRemoved(false);
    setOnlySak(false);
    setSpikeFocus(null);
    setSort('engagement');
  };

  const clearSpikeFilter = () => {
    setSpikeFocus(null);
  };

  const refreshList = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <AdminBackLink />
      <div className="space-y-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Radar className="h-6 w-6 text-brand" aria-hidden />
          Research
        </h1>
        <p className="text-sm text-muted-foreground">
          Interessesignaler til internt arbeid. Tall er ikke offentlige kilder.
        </p>
        <ResearchViewTabs active="signaler" spikeBadgeActive={spikeBadgeActive} />
        <RedditSpikeBadgePanel badge={spikeBadge} />
        {spikeFocus ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Vekstfilter er aktivt.</span>
            <button
              type="button"
              onClick={clearSpikeFilter}
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
            >
              Fjern vekstfilter
            </button>
          </div>
        ) : null}
        {initialData.previewFixture ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Forhåndsvisning med fixture-data (kun utvikling).
          </p>
        ) : null}
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Filter og sortering</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm">
            <span className={labelClass}>Subreddit</span>
            <select
              className={cn(fieldClass, 'mt-1')}
              value={subreddit}
              onChange={(e) => setSubreddit(e.target.value as RedditSignalSubreddit | '')}
            >
              {SUBREDDIT_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className={labelClass}>Tema</span>
            <input
              className={cn(fieldClass, 'mt-1')}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Delstreng i topic"
            />
          </label>
          <label className="block text-sm">
            <span className={labelClass}>Sortering</span>
            <select
              className={cn(fieldClass, 'mt-1')}
              value={sort}
              onChange={(e) => setSort(e.target.value as RedditSignalListFilters['sort'])}
            >
              {REDDIT_SIGNAL_SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {REDDIT_SIGNAL_SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className={labelClass}>Min. poeng</span>
            <input
              type="number"
              min={0}
              className={cn(fieldClass, 'mt-1')}
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className={labelClass}>Min. kommentarer</span>
            <input
              type="number"
              min={0}
              className={cn(fieldClass, 'mt-1')}
              value={minComments}
              onChange={(e) => setMinComments(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className={labelClass}>Min. relevans (1–5)</span>
            <input
              type="number"
              min={1}
              max={5}
              className={cn(fieldClass, 'mt-1')}
              value={minRelevance}
              onChange={(e) => setMinRelevance(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className={labelClass}>Status</span>
            <select
              className={cn(fieldClass, 'mt-1')}
              value={status}
              onChange={(e) => setStatus(e.target.value as RedditSignalListFilters['status'])}
            >
              <option value="">Alle statuser</option>
              {REDDIT_SIGNAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {REDDIT_SIGNAL_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hideRemoved}
              onChange={(e) => setHideRemoved(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Skjul fjernede
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlySak}
              onChange={(e) => setOnlySak(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Kun med sak-kobling (tema)
          </label>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
          >
            Nullstill filter
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Engasjement = poeng + 2×kommentarer + 5×kryssposter. Vekst 24 t er endring i engasjement
          mot nærmeste målepunkt før 24 timer siden.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        Viser {initialData.filteredTotal} av {initialData.total} signaler
      </p>

      {initialData.tableMissing ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {initialData.tableMissingMessage}
        </div>
      ) : null}

      {initialData.rows.length === 0 ? (
        <EmptyState title="Ingen signaler" description="Justér filter eller vent på ny innhenting." />
      ) : (
        <div className="space-y-3">
          {initialData.rows.map((row) => (
            <RedditSignalRow
              key={row.id}
              row={row}
              onUpdated={refreshList}
              spikeHighlight={rowIsListedInSpikeBadge(row, spikeBadge)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Handlinger: {Object.values(REDDIT_SIGNAL_ACTION_LABELS).join(' · ')}
      </p>
    </div>
  );
}