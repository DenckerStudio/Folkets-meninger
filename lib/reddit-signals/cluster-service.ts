import { getServiceSupabase } from '@/lib/supabase';
import { isRedditSignalsFixturePreviewAllowed } from '@/lib/reddit-signals/preview';
import { buildRedditSignalsFixtureList } from '@/lib/reddit-signals/mock-fixture';
import { aggregateRedditClusters, countUnclusteredSignals } from '@/lib/reddit-signals/cluster-aggregate';
import {
  filterRedditClusters,
  sortRedditClusters,
} from '@/lib/reddit-signals/cluster-sort-filter';
import {
  mapRedditClusterStatsRow,
  type RedditClusterStatsDbRow,
} from '@/lib/reddit-signals/cluster-db-map';
import type {
  RedditClusterListFilters,
  RedditClusterListResponse,
  RedditClusterSummary,
} from '@/lib/reddit-signals/cluster-types';

function isMissingClusterViewError(error: { message?: string } | null): boolean {
  if (!error) return false;
  return /reddit_cluster_stats|reddit_cluster_meta|does not exist|undefined_table/i.test(
    error.message ?? '',
  );
}

async function loadClustersFromDb(): Promise<{
  clusters: RedditClusterSummary[];
  totalClusters: number;
  unclusteredCount: number;
  viewMissing: boolean;
  viewMissingMessage: string | null;
}> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      clusters: [],
      totalClusters: 0,
      unclusteredCount: 0,
      viewMissing: true,
      viewMissingMessage:
        'Temaklynger krever service role på serveren (SUPABASE_SERVICE_ROLE_KEY).',
    };
  }

  let supabase;
  try {
    supabase = getServiceSupabase();
  } catch {
    return {
      clusters: [],
      totalClusters: 0,
      unclusteredCount: 0,
      viewMissing: true,
      viewMissingMessage: 'Kunne ikke koble til databasen for temaklynger.',
    };
  }

  const [statsResult, metaResult] = await Promise.all([
    supabase
      .from('reddit_cluster_stats')
      .select(
        'cluster_id, post_count, sum_score, sum_comments, growth_24h, last_seen_at, status_ny, status_brukt, status_ignorert, status_auto_ignorert, status_blokkert, topics, subreddits, top_post_id, top_post_title, top_post_url, top_post_score, top_post_num_comments, top_post_subreddit',
      )
      .order('last_seen_at', { ascending: false }),
    supabase.from('reddit_cluster_meta').select('total_clusters, unclustered_signals').maybeSingle(),
  ]);

  if (statsResult.error) {
    if (isMissingClusterViewError(statsResult.error)) {
      return {
        clusters: [],
        totalClusters: 0,
        unclusteredCount: 0,
        viewMissing: true,
        viewMissingMessage:
          'Klyngevisningen er ikke tilgjengelig ennå. En administrator må kjøre den ventende databasemigrasjonen.',
      };
    }
    return {
      clusters: [],
      totalClusters: 0,
      unclusteredCount: 0,
      viewMissing: true,
      viewMissingMessage: 'Kunne ikke hente temaklynger akkurat nå.',
    };
  }

  const clusters = ((statsResult.data ?? []) as RedditClusterStatsDbRow[]).map(
    mapRedditClusterStatsRow,
  );

  const meta = metaResult.data as
    | { total_clusters: number; unclustered_signals: number }
    | null;

  return {
    clusters,
    totalClusters: meta?.total_clusters ?? clusters.length,
    unclusteredCount: meta?.unclustered_signals ?? 0,
    viewMissing: false,
    viewMissingMessage: null,
  };
}

export async function listRedditClustersForAdmin(
  filters: RedditClusterListFilters,
  previewParam?: string | null,
): Promise<RedditClusterListResponse> {
  if (isRedditSignalsFixturePreviewAllowed(previewParam)) {
    const { rows } = buildRedditSignalsFixtureList();
    const allClusters = aggregateRedditClusters(rows);
    const filtered = filterRedditClusters(allClusters, filters);
    return {
      clusters: sortRedditClusters(filtered, filters.sort),
      totalClusters: allClusters.length,
      filteredTotal: filtered.length,
      unclusteredCount: countUnclusteredSignals(rows),
      previewFixture: true,
      tableMissing: false,
      tableMissingMessage: null,
    };
  }

  let loaded;
  try {
    loaded = await loadClustersFromDb();
  } catch {
    return {
      clusters: [],
      totalClusters: 0,
      filteredTotal: 0,
      unclusteredCount: 0,
      previewFixture: false,
      tableMissing: true,
      tableMissingMessage: 'Kunne ikke hente temaklynger akkurat nå.',
    };
  }
  if (loaded.viewMissing) {
    return {
      clusters: [],
      totalClusters: 0,
      filteredTotal: 0,
      unclusteredCount: 0,
      previewFixture: false,
      tableMissing: true,
      tableMissingMessage: loaded.viewMissingMessage,
    };
  }

  const filtered = filterRedditClusters(loaded.clusters, filters);

  return {
    clusters: sortRedditClusters(filtered, filters.sort),
    totalClusters: loaded.totalClusters,
    filteredTotal: filtered.length,
    unclusteredCount: loaded.unclusteredCount,
    previewFixture: false,
    tableMissing: false,
    tableMissingMessage: null,
  };
}