'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Layers, Radar } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { RedditLearningStatsPanel } from '@/components/admin/reddit-learning-stats-panel';
import { ResearchViewTabs } from '@/components/admin/research-view-tabs';
import { EmptyState } from '@/components/dashboard/empty-state';
import type { RedditSignalSubreddit } from '@/lib/admin/oppfanget/types';
import {
  REDDIT_CLUSTER_SORT_KEYS,
  redditClusterFiltersAreActive,
  type RedditClusterListFilters,
  type RedditClusterListResponse,
  type RedditClusterSummary,
  type RedditLearningStatsResponse,
} from '@/lib/reddit-signals/cluster-types';
import { buildRedditTemaerAdminPath } from '@/lib/reddit-signals/cluster-query';
import { REDDIT_CLUSTER_SORT_LABELS } from '@/lib/reddit-signals/cluster-labels';
import { REDDIT_SIGNAL_STATUS_LABELS } from '@/lib/reddit-signals/labels';
import { buildRedditSignalsAdminPath } from '@/lib/reddit-signals/query';
import type { RedditSignalListFilters } from '@/lib/reddit-signals/types';
import { RedditSubredditBadge } from '@/lib/reddit-signals/format';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import { cn } from '@/lib/utils';

const FILTER_DEBOUNCE_MS = 300;
const fieldClass =
  'min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const labelClass = 'text-xs font-medium text-muted-foreground';
const chipClass =
  'inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-foreground';

const SUBREDDIT_OPTIONS: { value: '' | RedditSignalSubreddit; label: string }[] = [
  { value: '', label: 'Alle subreddits' },
  { value: 'norge', label: 'r/norge' },
  { value: 'norske', label: 'r/norske' },
  { value: 'Nordmenn', label: 'r/Nordmenn' },
];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function signalListFiltersForCluster(clusterId: string): RedditSignalListFilters {
  return {
    subreddit: '',
    topic: '',
    cluster: clusterId,
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
}

function StatusDistribution({ cluster }: { cluster: RedditClusterSummary }) {
  const entries = (
    Object.entries(cluster.statusCounts) as [keyof typeof cluster.statusCounts, number][]
  )
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Statusfordeling">
      {entries.map(([status, count]) => (
        <li key={status}>
          <span className={chipClass}>
            {REDDIT_SIGNAL_STATUS_LABELS[status]}: {count}
          </span>
        </li>
      ))}
    </ul>
  );
}

function clusterCardTitle(cluster: RedditClusterSummary): string {
  const topTitle = cluster.topPost?.title?.trim();
  if (topTitle) return topTitle;
  if (cluster.topics[0]) return cluster.topics[0];
  return cluster.clusterId;
}

function ClusterMetrics({ cluster }: { cluster: RedditClusterSummary }) {
  const growth =
    cluster.growth24h === null
      ? '—'
      : `${cluster.growth24h >= 0 ? '+' : ''}${cluster.growth24h.toLocaleString('nb-NO')}`;
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={chipClass} title="Sum poeng">
        <span className="sr-only">Sum poeng: </span>
        {cluster.sumScore.toLocaleString('nb-NO')} poeng
      </span>
      <span className={chipClass} title="Sum kommentarer">
        <span className="sr-only">Sum kommentarer: </span>
        {cluster.sumComments.toLocaleString('nb-NO')} kommentarer
      </span>
      <span className={chipClass} title="Vekst siste 24 timer">
        <span className="sr-only">Vekst 24 t: </span>
        {growth}
      </span>
    </div>
  );
}

function ClusterCard({ cluster, preview }: { cluster: RedditClusterSummary; preview?: string }) {
  const signalsHref = buildRedditSignalsAdminPath(
    signalListFiltersForCluster(cluster.clusterId),
    preview === 'fixture' ? 'fixture' : null,
  );
  const heading = clusterCardTitle(cluster);
  const showClusterIdBelow = heading !== cluster.clusterId;

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground line-clamp-2">{heading}</h3>
            <span className={chipClass}>{cluster.postCount} innlegg</span>
          </div>
          {showClusterIdBelow ? (
            <p className="text-xs text-muted-foreground break-all">Klynge: {cluster.clusterId}</p>
          ) : null}
          <ClusterMetrics cluster={cluster} />
          {cluster.topics.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Temaer: <span className="text-foreground">{cluster.topics.join(', ')}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {cluster.subreddits.map((sub) => (
              <RedditSubredditBadge key={sub} subreddit={sub} />
            ))}
          </div>
        </div>
        <Link
          href={signalsHref}
          className={cn(
            'inline-flex min-h-11 shrink-0 items-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-brand hover:bg-muted',
            VURDER_FOCUS_RING,
          )}
        >
          Vis signaler
        </Link>
      </div>

      {cluster.topPost ? (
        <div className="mt-3 rounded-lg border border-border/80 bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">Toppinnlegg</p>
          <a
            href={cluster.topPost.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'mt-1 inline-flex min-h-11 max-w-full items-center gap-1 text-sm font-medium text-brand hover:underline',
              VURDER_FOCUS_RING,
            )}
          >
            <span className="line-clamp-2">{cluster.topPost.title}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {cluster.topPost.score.toLocaleString('nb-NO')} poeng ·{' '}
            {cluster.topPost.numComments.toLocaleString('nb-NO')} kommentarer
          </p>
        </div>
      ) : null}

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Status</p>
        <StatusDistribution cluster={cluster} />
      </div>
    </article>
  );
}

export default function RedditClustersClient({
  initialData,
  initialFilters,
  learningStats,
  devPreview,
  spikeBadgeActive,
}: {
  initialData: RedditClusterListResponse;
  initialFilters: RedditClusterListFilters;
  learningStats: RedditLearningStatsResponse;
  devPreview?: string;
  spikeBadgeActive?: boolean;
}) {
  const router = useRouter();
  const [isListPending, startListTransition] = useTransition();
  const urlSyncReadyRef = useRef(false);
  const suppressUrlSyncRef = useRef(false);

  const [subreddit, setSubreddit] = useState(initialFilters.subreddit);
  const [topic, setTopic] = useState(initialFilters.topic);
  const [minPosts, setMinPosts] = useState(
    initialFilters.minPosts !== null ? String(initialFilters.minPosts) : '',
  );
  const [sort, setSort] = useState(initialFilters.sort);
  const debouncedTopic = useDebouncedValue(topic, FILTER_DEBOUNCE_MS);
  const debouncedMinPosts = useDebouncedValue(minPosts, FILTER_DEBOUNCE_MS);

  const parseFilterNum = (s: string) => {
    const t = s.trim();
    if (!t) return null;
    const n = Number.parseInt(t, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const urlFilters = useMemo<RedditClusterListFilters>(
    () => ({
      subreddit,
      topic: debouncedTopic.trim(),
      minPosts: parseFilterNum(debouncedMinPosts),
      sort,
    }),
    [subreddit, debouncedTopic, debouncedMinPosts, sort],
  );

  const previewParam = devPreview === 'fixture' ? 'fixture' : null;

  const filtersActive = redditClusterFiltersAreActive(initialFilters);

  useEffect(() => {
    if (suppressUrlSyncRef.current) return;
    const path = buildRedditTemaerAdminPath(urlFilters, previewParam);
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
    setMinPosts('');
    setSort('posts');
    const cleared: RedditClusterListFilters = {
      subreddit: '',
      topic: '',
      minPosts: null,
      sort: 'posts',
    };
    startListTransition(() => {
      router.replace(buildRedditTemaerAdminPath(cleared, previewParam), { scroll: false });
    });
    window.setTimeout(() => {
      suppressUrlSyncRef.current = false;
    }, FILTER_DEBOUNCE_MS + 50);
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
          Temaklynger fra interessesignaler (cluster_id fra arbeidsflyt). Kun for intern bruk.
        </p>
        <ResearchViewTabs
          active="temaer"
          spikeBadgeActive={spikeBadgeActive}
          devPreview={devPreview}
        />
        {initialData.previewFixture ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Forhåndsvisning med fixture-data (kun utvikling).
          </p>
        ) : null}
      </div>

      <RedditLearningStatsPanel data={learningStats} />

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Layers className="h-4 w-4 text-brand" aria-hidden />
          Temaklynger
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              placeholder="Delstreng i tema"
            />
          </label>
          <label className="block text-sm">
            <span className={labelClass}>Min. innlegg i klynge</span>
            <input
              type="number"
              min={0}
              className={cn(fieldClass, 'mt-1')}
              value={minPosts}
              onChange={(e) => setMinPosts(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className={labelClass}>Sortering</span>
            <select
              className={cn(fieldClass, 'mt-1')}
              value={sort}
              onChange={(e) => setSort(e.target.value as RedditClusterListFilters['sort'])}
            >
              {REDDIT_CLUSTER_SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {REDDIT_CLUSTER_SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={clearFilters}
            className={cn(
              'inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-4 text-sm hover:bg-muted',
              VURDER_FOCUS_RING,
            )}
          >
            Nullstill filter
          </button>
          {isListPending ? (
            <span className="inline-flex min-h-11 items-center text-xs text-muted-foreground" role="status">
              Oppdaterer …
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Viser {initialData.filteredTotal} av {initialData.totalClusters} klynger
          {initialData.unclusteredCount > 0
            ? ` (${initialData.unclusteredCount} signaler uten cluster_id er ikke med her)`
            : null}
          .
        </p>
      </section>

      {initialData.tableMissing ? (
        <p className="text-sm text-destructive" role="alert">
          {initialData.tableMissingMessage}
        </p>
      ) : initialData.clusters.length === 0 && filtersActive ? (
        <EmptyState
          icon={<Layers className="h-8 w-8 text-muted-foreground" aria-hidden />}
          title="Ingen klynger matcher filteret"
          description="Prøv andre filterverdier, eller nullstill for å se alle klynger."
          action={
            <button
              type="button"
              onClick={clearFilters}
              className={cn(
                'inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted',
                VURDER_FOCUS_RING,
              )}
            >
              Nullstill filter
            </button>
          }
        />
      ) : initialData.clusters.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-8 w-8 text-muted-foreground" aria-hidden />}
          title="Ingen temaklynger"
          description="Når innlegg har cluster_id fra arbeidsflyten, grupperes de her."
        />
      ) : (
        <div className="space-y-4" aria-busy={isListPending}>
          {initialData.clusters.map((cluster) => (
            <ClusterCard key={cluster.clusterId} cluster={cluster} preview={devPreview} />
          ))}
        </div>
      )}
    </div>
  );
}