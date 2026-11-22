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
import { ResearchTopicUseFindingButton } from '@/components/admin/research-topic-use-finding-button';
import { ResearchViewTabs } from '@/components/admin/research-view-tabs';
import { ResearchWebhookNotice } from '@/components/admin/research-webhook-notice';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/dashboard/empty-state';
import type { RedditSignalSubreddit } from '@/lib/admin/oppfanget/types';
import type { ResearchTopicSnapshot } from '@/lib/admin/research/topic-types';
import {
  REDDIT_SIGNAL_SORT_KEYS,
  REDDIT_SIGNAL_STATUSES,
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
  REDDIT_SIGNAL_SORT_LABELS,
  REDDIT_SIGNAL_STATUS_LABELS,
} from '@/lib/reddit-signals/labels';
import { REDDIT_SIGNALS_LIST_LIMIT } from '@/lib/reddit-signals/admin-map';
import { RedditSubredditBadge, formatRedditContention } from '@/lib/reddit-signals/format';
import { isReplyWorthSuggested } from '@/lib/reddit-signals/reply-worth-gate';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const REASON_MIN_LENGTH = 3;
const FILTER_DEBOUNCE_MS = 300;

const actionButtonClass = cn(
  'inline-flex min-h-11 items-center rounded-lg border px-3 text-xs font-medium disabled:opacity-50',
  VURDER_FOCUS_RING,
);

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

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

function ReasonFields({
  reason,
  onReasonChange,
  dialogError,
  reasonValid,
}: {
  reason: string;
  onReasonChange: (value: string) => void;
  dialogError: string;
  reasonValid: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm">
        <span className={labelClass}>Begrunnelse</span>
        <textarea
          className={cn(fieldClass, 'mt-1 min-h-[88px]')}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          aria-invalid={!reasonValid && reason.length > 0}
        />
      </label>
      <p className="text-xs text-muted-foreground">Minst 3 tegn</p>
      {dialogError ? (
        <p className="text-xs text-destructive" role="alert">
          {dialogError}
        </p>
      ) : null}
    </div>
  );
}

function RedditSignalRowActions({
  row,
  topicSnapshot,
  onUpdated,
}: {
  row: RedditSignalAdminRow;
  topicSnapshot?: ResearchTopicSnapshot | null;
  onUpdated: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [reason, setReason] = useState('');

  const reasonValid = reason.trim().length >= REASON_MIN_LENGTH;
  const blocked = row.status === 'blokkert';

  const openDialog = () => {
    setReason('');
    setDialogError('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (pending) return;
    setDialogOpen(false);
    setDialogError('');
    setReason('');
  };

  const ignoreSignal = useCallback(async () => {
    setPending(true);
    setDialogError('');
    try {
      const res = await fetch(
        `/api/admin/reddit-signals/${encodeURIComponent(row.id)}/ignorer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setDialogError(json.message ?? 'Handlingen feilet');
        return;
      }
      setDialogOpen(false);
      setReason('');
      onUpdated();
    } catch {
      setDialogError('Handlingen feilet');
    } finally {
      setPending(false);
    }
  }, [onUpdated, reason, row.id]);

  return (
    <div className="flex flex-col gap-2">
      {(row.status === 'ignorert' || row.status === 'auto_ignorert') && (
        <p className="text-xs text-muted-foreground">
          Ignorerte signaler forblir i listen. Det finnes ingen knapp for å sette status tilbake til
          «Ny».
        </p>
      )}
      <div className="flex flex-wrap items-start gap-2">
        <button
          type="button"
          disabled={pending || blocked}
          onClick={openDialog}
          className={cn(actionButtonClass, 'border-border bg-card hover:bg-muted')}
        >
          Ignorer
        </button>
        <ResearchTopicUseFindingButton
          sourceKind="reddit"
          redditSignalId={row.id}
          title={row.title}
          initialSnapshot={topicSnapshot}
          idleLabel="Bruk"
          compact
          disabled={pending || blocked}
          onStarted={onUpdated}
          className="w-auto"
          controlClassName="w-auto"
        />
      </div>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title="Ignorer signal"
        description="Oppgi hvorfor signalet skal ignoreres. Dette logges internt."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={cn(
                'inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm',
                VURDER_FOCUS_RING,
              )}
              onClick={closeDialog}
              disabled={pending}
            >
              Avbryt
            </button>
            <button
              type="button"
              className={cn(
                'inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground disabled:opacity-50',
                VURDER_FOCUS_RING,
              )}
              disabled={pending || !reasonValid}
              onClick={() => void ignoreSignal()}
            >
              {pending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {pending ? 'Lagrer…' : 'Lagre'}
            </button>
          </div>
        }
      >
        <ReasonFields
          reason={reason}
          dialogError={dialogError}
          reasonValid={reasonValid}
          onReasonChange={(value) => {
            setReason(value);
            if (dialogError) setDialogError('');
          }}
        />
      </Dialog>
    </div>
  );
}

function RedditSignalRow({
  row,
  topicSnapshot,
  onUpdated,
  spikeHighlight,
}: {
  row: RedditSignalAdminRow;
  topicSnapshot?: ResearchTopicSnapshot | null;
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
            {isReplyWorthSuggested(row.replyWorth) ? (
              <span
                className={cn(chipClass, 'border-brand/40 bg-brand/10 text-brand')}
                title={row.replyWorthReason ?? undefined}
              >
                Verdt å svare
              </span>
            ) : null}
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
          {row.replyWorth !== null ? (
            <p className="text-xs text-muted-foreground">
              Svarverdi:{' '}
              <span className="font-medium tabular-nums text-foreground">{row.replyWorth}/5</span>
              {row.replyWorthReason ? ` — ${row.replyWorthReason}` : null}
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
        <RedditSignalRowActions
          row={row}
          topicSnapshot={topicSnapshot}
          onUpdated={onUpdated}
        />
      </div>
    </article>
  );
}

export default function RedditSignalsClient({
  initialData,
  initialFilters,
  devPreview,
  spikeBadge,
  researchTopicsBySignalId,
  researchWebhooksConfigured,
  missingResearchWebhookEnvKeys,
}: {
  initialData: RedditSignalListResponse;
  initialFilters: RedditSignalListFilters;
  devPreview?: string;
  spikeBadge: RedditSpikeBadgeView | null;
  researchTopicsBySignalId: Record<string, ResearchTopicSnapshot>;
  researchWebhooksConfigured: boolean;
  missingResearchWebhookEnvKeys: string[];
}) {
  const router = useRouter();
  const [isListPending, startListTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const urlSyncReadyRef = useRef(false);
  const suppressUrlSyncRef = useRef(false);

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
  const [onlyWorth, setOnlyWorth] = useState(initialFilters.onlyWorthReplying);
  const [status, setStatus] = useState(initialFilters.status);
  const [hideRemoved, setHideRemoved] = useState(initialFilters.hideRemoved);
  const [onlySak, setOnlySak] = useState(initialFilters.onlyWithSakLink);
  const [sort, setSort] = useState(initialFilters.sort);
  const clusterFilter = initialFilters.cluster;
  const debouncedTopic = useDebouncedValue(topic, FILTER_DEBOUNCE_MS);
  const debouncedMinScore = useDebouncedValue(minScore, FILTER_DEBOUNCE_MS);
  const debouncedMinComments = useDebouncedValue(minComments, FILTER_DEBOUNCE_MS);
  const debouncedMinRelevance = useDebouncedValue(minRelevance, FILTER_DEBOUNCE_MS);

  const spikeBadgeActive = spikeBadge !== null && spikeBadge.items.length > 0;

  const parseFilterNum = (s: string) => {
    const t = s.trim();
    if (!t) return null;
    const n = Number.parseInt(t, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const urlFilters = useMemo<RedditSignalListFilters>(
    () => ({
      subreddit,
      topic: debouncedTopic.trim(),
      minScore: parseFilterNum(debouncedMinScore),
      minComments: parseFilterNum(debouncedMinComments),
      minRelevance: parseFilterNum(debouncedMinRelevance),
      onlyWorthReplying: onlyWorth,
      status,
      hideRemoved,
      onlyWithSakLink: onlySak,
      spikeFocus: initialFilters.spikeFocus,
      sort,
      cluster: clusterFilter,
    }),
    [
      subreddit,
      debouncedTopic,
      debouncedMinScore,
      debouncedMinComments,
      debouncedMinRelevance,
      onlyWorth,
      status,
      hideRemoved,
      onlySak,
      initialFilters.spikeFocus,
      sort,
      clusterFilter,
    ],
  );

  const previewParam = devPreview === 'fixture' ? 'fixture' : null;
  const listPending = isListPending || isRefreshing;

  useEffect(() => {
    if (suppressUrlSyncRef.current) return;
    const path = buildRedditSignalsAdminPath(urlFilters, previewParam);
    if (!urlSyncReadyRef.current) {
      urlSyncReadyRef.current = true;
      if (typeof window !== 'undefined') {
        const current = window.location.pathname + window.location.search;
        if (path === current) return;
      }
    }
    startListTransition(() => {
      router.replace(path, { scroll: false });
    });
  }, [urlFilters, previewParam, router]);

  const clearFilters = () => {
    suppressUrlSyncRef.current = true;
    setSubreddit('');
    setTopic('');
    setMinScore('');
    setMinComments('');
    setMinRelevance('');
    setOnlyWorth(false);
    setStatus('');
    setHideRemoved(false);
    setOnlySak(false);
    setSort('engagement');
    const cleared: RedditSignalListFilters = {
      subreddit: '',
      topic: '',
      cluster: '',
      minScore: null,
      minComments: null,
      minRelevance: null,
      onlyWorthReplying: false,
      status: '',
      hideRemoved: false,
      onlyWithSakLink: false,
      spikeFocus: null,
      sort: 'engagement',
    };
    startListTransition(() => {
      router.replace(buildRedditSignalsAdminPath(cleared, previewParam), { scroll: false });
    });
    window.setTimeout(() => {
      suppressUrlSyncRef.current = false;
    }, FILTER_DEBOUNCE_MS + 50);
  };

  const clearSpikeFilter = () => {
    const next: RedditSignalListFilters = { ...urlFilters, spikeFocus: null };
    startListTransition(() => {
      router.replace(buildRedditSignalsAdminPath(next, previewParam), { scroll: false });
    });
  };

  const refreshList = () => {
    startRefreshTransition(() => {
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
        <ResearchViewTabs
          active="signaler"
          spikeBadgeActive={spikeBadgeActive}
          devPreview={devPreview}
        />
        <RedditSpikeBadgePanel badge={spikeBadge} />
        {initialFilters.spikeFocus ? (
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
        {clusterFilter ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              Klyngefilter: <span className="font-medium text-foreground">{clusterFilter}</span>
            </span>
            <Link
              href={buildRedditSignalsAdminPath(
                { ...initialFilters, cluster: '' },
                previewParam,
              )}
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
            >
              Fjern klyngefilter
            </Link>
          </div>
        ) : null}
        {initialData.previewFixture ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Forhåndsvisning med fixture-data (kun utvikling).
          </p>
        ) : (
          <ResearchWebhookNotice
            configured={researchWebhooksConfigured}
            missingEnvKeys={missingResearchWebhookEnvKeys}
          />
        )}
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
              checked={onlyWorth}
              onChange={(e) => setOnlyWorth(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Kun verdt å svare
          </label>
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
        Viser {initialData.filteredTotal} treff av siste {initialData.total} signaler (maks{' '}
        {REDDIT_SIGNALS_LIST_LIMIT.toLocaleString('nb-NO')} etter «sist sett»).
      </p>

      {listPending ? (
        <p className="text-xs text-muted-foreground" role="status">
          <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin align-[-2px]" aria-hidden />
          Oppdaterer listen…
        </p>
      ) : null}

      {initialData.tableMissing ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {initialData.tableMissingMessage}
        </div>
      ) : null}

      {initialData.rows.length === 0 && !initialData.tableMissing ? (
        <EmptyState
          title="Ingen signaler"
          description={
            initialFilters.onlyWorthReplying
              ? 'Ingen signaler med svarverdi 4–5 i utvalget. Fjern filteret eller vent på ny scoring.'
              : 'Justér filter eller vent på ny innhenting.'
          }
        />
      ) : initialData.rows.length > 0 ? (
        <div className={cn('space-y-3', listPending && 'opacity-60')}>
          {initialData.rows.map((row) => (
            <RedditSignalRow
              key={row.id}
              row={row}
              topicSnapshot={researchTopicsBySignalId[row.id]}
              onUpdated={refreshList}
              spikeHighlight={rowIsListedInSpikeBadge(row, spikeBadge)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}