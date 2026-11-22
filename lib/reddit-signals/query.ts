import type { RedditSignalSubreddit } from '@/lib/admin/oppfanget/types';
import {
  REDDIT_SIGNAL_SORT_KEYS,
  REDDIT_SIGNAL_STATUSES,
  type RedditSignalListFilters,
  type RedditSignalSortKey,
  type RedditSignalStatus,
} from '@/lib/reddit-signals/types';
import { parseSpikeFocusParam, spikeFocusToQueryParam } from '@/lib/reddit-signals/spike-badge';
import { routes } from '@/lib/routes';

const SUBREDDITS: RedditSignalSubreddit[] = ['norge', 'norske', 'Nordmenn'];

function parseSubreddit(value: string): RedditSignalSubreddit | '' {
  if (!value) return '';
  return SUBREDDITS.includes(value as RedditSignalSubreddit)
    ? (value as RedditSignalSubreddit)
    : '';
}

function parseStatus(value: string): RedditSignalStatus | '' {
  if (!value) return '';
  return REDDIT_SIGNAL_STATUSES.includes(value as RedditSignalStatus)
    ? (value as RedditSignalStatus)
    : '';
}

function parseSort(value: string): RedditSignalSortKey {
  if (REDDIT_SIGNAL_SORT_KEYS.includes(value as RedditSignalSortKey)) {
    return value as RedditSignalSortKey;
  }
  return 'engagement';
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parseBoolFlag(value: string | undefined): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

export function parseRedditSignalsFilters(
  input: Record<string, string | string[] | undefined>,
): RedditSignalListFilters {
  const pick = (key: string) => {
    const raw = input[key];
    return typeof raw === 'string' ? raw : '';
  };
  return {
    subreddit: parseSubreddit(pick('subreddit')),
    topic: pick('topic').trim(),
    cluster: pick('cluster').trim(),
    minScore: parseOptionalInt(pick('minScore')),
    minComments: parseOptionalInt(pick('minComments')),
    minRelevance: parseOptionalInt(pick('minRelevance')),
    onlyWorthReplying: parseBoolFlag(pick('worth')),
    status: parseStatus(pick('status')),
    hideRemoved: parseBoolFlag(pick('hideRemoved')),
    onlyWithSakLink: parseBoolFlag(pick('onlySak')),
    spikeFocus: parseSpikeFocusParam(pick('spike')),
    sort: parseSort(pick('sort')),
  };
}

export function buildRedditSignalsQueryString(
  filters: RedditSignalListFilters,
  preview?: string | null,
): string {
  const params = new URLSearchParams();
  params.set('view', 'signaler');
  if (filters.subreddit) params.set('subreddit', filters.subreddit);
  if (filters.topic) params.set('topic', filters.topic);
  if (filters.cluster) params.set('cluster', filters.cluster);
  if (filters.minScore !== null) params.set('minScore', String(filters.minScore));
  if (filters.minComments !== null) params.set('minComments', String(filters.minComments));
  if (filters.minRelevance !== null) params.set('minRelevance', String(filters.minRelevance));
  if (filters.onlyWorthReplying) params.set('worth', '1');
  if (filters.status) params.set('status', filters.status);
  if (filters.hideRemoved) params.set('hideRemoved', '1');
  if (filters.onlyWithSakLink) params.set('onlySak', '1');
  if (filters.spikeFocus) {
    const spike = spikeFocusToQueryParam(filters.spikeFocus);
    if (spike) params.set('spike', spike);
  }
  if (filters.sort !== 'engagement') params.set('sort', filters.sort);
  if (preview === 'fixture') params.set('preview', 'fixture');
  return params.toString();
}

export function buildRedditSignalsAdminPath(
  filters: RedditSignalListFilters,
  preview?: string | null,
): string {
  const query = buildRedditSignalsQueryString(filters, preview);
  return `${routes.adminResearch}?${query}`;
}

export { isRedditSignalsView, isRedditTemaerView } from '@/lib/reddit-signals/research-view';