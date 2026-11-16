import type { RedditSignalSubreddit } from '@/lib/admin/oppfanget/types';
import {
  REDDIT_CLUSTER_SORT_KEYS,
  type RedditClusterListFilters,
  type RedditClusterSortKey,
} from '@/lib/reddit-signals/cluster-types';
import { routes } from '@/lib/routes';

const SUBREDDITS: RedditSignalSubreddit[] = ['norge', 'norske', 'Nordmenn'];

function parseSubreddit(value: string): RedditSignalSubreddit | '' {
  if (!value) return '';
  return SUBREDDITS.includes(value as RedditSignalSubreddit)
    ? (value as RedditSignalSubreddit)
    : '';
}

function parseSort(value: string): RedditClusterSortKey {
  if (REDDIT_CLUSTER_SORT_KEYS.includes(value as RedditClusterSortKey)) {
    return value as RedditClusterSortKey;
  }
  return 'posts';
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function parseRedditClusterFilters(
  input: Record<string, string | string[] | undefined>,
): RedditClusterListFilters {
  const pick = (key: string) => {
    const raw = input[key];
    return typeof raw === 'string' ? raw : '';
  };
  return {
    subreddit: parseSubreddit(pick('subreddit')),
    topic: pick('topic').trim(),
    minPosts: parseOptionalInt(pick('minPosts')),
    sort: parseSort(pick('sort')),
  };
}

export function buildRedditTemaerQueryString(
  filters: RedditClusterListFilters,
  preview?: string | null,
): string {
  const params = new URLSearchParams();
  params.set('view', 'temaer');
  if (filters.subreddit) params.set('subreddit', filters.subreddit);
  if (filters.topic) params.set('topic', filters.topic);
  if (filters.minPosts !== null) params.set('minPosts', String(filters.minPosts));
  if (filters.sort !== 'posts') params.set('sort', filters.sort);
  if (preview === 'fixture') params.set('preview', 'fixture');
  return params.toString();
}

export function buildRedditTemaerAdminPath(
  filters: RedditClusterListFilters,
  preview?: string | null,
): string {
  const query = buildRedditTemaerQueryString(filters, preview);
  return `${routes.adminResearch}?${query}`;
}