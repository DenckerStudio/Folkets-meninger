import { listRedditSignalsForAdmin } from '@/lib/reddit-signals/service';
import {
  aggregateRedditClusters,
  countUnclusteredSignals,
} from '@/lib/reddit-signals/cluster-aggregate';
import {
  filterRedditClusters,
  sortRedditClusters,
} from '@/lib/reddit-signals/cluster-sort-filter';
import type {
  RedditClusterListFilters,
  RedditClusterListResponse,
} from '@/lib/reddit-signals/cluster-types';

export async function listRedditClustersForAdmin(
  filters: RedditClusterListFilters,
  previewParam?: string | null,
): Promise<RedditClusterListResponse> {
  const signalList = await listRedditSignalsForAdmin(
    {
      subreddit: '',
      topic: '',
      minScore: null,
      minComments: null,
      minRelevance: null,
      status: '',
      hideRemoved: false,
      onlyWithSakLink: false,
      spikeFocus: null,
      sort: 'engagement',
      cluster: '',
    },
    previewParam,
  );

  if (signalList.tableMissing) {
    return {
      clusters: [],
      totalClusters: 0,
      filteredTotal: 0,
      unclusteredCount: 0,
      previewFixture: signalList.previewFixture,
      tableMissing: true,
      tableMissingMessage: signalList.tableMissingMessage,
    };
  }

  const allClusters = aggregateRedditClusters(signalList.rows);
  const filtered = filterRedditClusters(allClusters, filters);

  return {
    clusters: sortRedditClusters(filtered, filters.sort),
    totalClusters: allClusters.length,
    filteredTotal: filtered.length,
    unclusteredCount: countUnclusteredSignals(signalList.rows),
    previewFixture: signalList.previewFixture,
    tableMissing: false,
    tableMissingMessage: null,
  };
}