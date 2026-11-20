import type { RedditSignalSubreddit } from '@/lib/admin/oppfanget/types';
import type {
  RedditClusterListFilters,
  RedditClusterSortKey,
  RedditClusterSummary,
} from '@/lib/reddit-signals/cluster-types';

function clusterMatchesSubreddit(
  cluster: RedditClusterSummary,
  subreddit: RedditSignalSubreddit,
): boolean {
  return cluster.subreddits.includes(subreddit);
}

function clusterMatchesTopic(cluster: RedditClusterSummary, topicNeedle: string): boolean {
  const needle = topicNeedle.toLowerCase();
  return cluster.topics.some((t) => t.toLowerCase().includes(needle));
}

export function filterRedditClusters(
  clusters: RedditClusterSummary[],
  filters: RedditClusterListFilters,
): RedditClusterSummary[] {
  return clusters.filter((cluster) => {
    if (filters.subreddit && !clusterMatchesSubreddit(cluster, filters.subreddit)) {
      return false;
    }
    if (filters.topic && !clusterMatchesTopic(cluster, filters.topic)) {
      return false;
    }
    if (filters.minPosts !== null && cluster.postCount < filters.minPosts) {
      return false;
    }
    return true;
  });
}

function sortValue(cluster: RedditClusterSummary, key: RedditClusterSortKey): number | string {
  switch (key) {
    case 'posts':
      return cluster.postCount;
    case 'score':
      return cluster.sumScore;
    case 'comments':
      return cluster.sumComments;
    case 'growth24h':
      return cluster.growth24h ?? Number.NEGATIVE_INFINITY;
    case 'last_seen':
      return cluster.lastSeenAt;
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

export function sortRedditClusters(
  clusters: RedditClusterSummary[],
  sort: RedditClusterSortKey,
): RedditClusterSummary[] {
  const copy = [...clusters];
  copy.sort((a, b) => {
    const av = sortValue(a, sort);
    const bv = sortValue(b, sort);
    if (sort === 'last_seen') {
      return String(bv).localeCompare(String(av));
    }
    const an = typeof av === 'number' ? av : 0;
    const bn = typeof bv === 'number' ? bv : 0;
    if (bn !== an) return bn - an;
    return b.clusterId.localeCompare(a.clusterId, 'nb');
  });
  return copy;
}