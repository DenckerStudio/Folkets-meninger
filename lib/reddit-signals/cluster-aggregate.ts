import { REDDIT_SIGNAL_STATUSES, type RedditSignalAdminRow } from '@/lib/reddit-signals/types';
import type { RedditClusterSummary, RedditClusterStatusCounts } from '@/lib/reddit-signals/cluster-types';

function emptyStatusCounts(): RedditClusterStatusCounts {
  const counts = {} as RedditClusterStatusCounts;
  for (const status of REDDIT_SIGNAL_STATUSES) {
    counts[status] = 0;
  }
  return counts;
}

export function aggregateRedditClusters(rows: RedditSignalAdminRow[]): RedditClusterSummary[] {
  const byCluster = new Map<string, RedditSignalAdminRow[]>();

  for (const row of rows) {
    const key = row.clusterId?.trim();
    if (!key) continue;
    const bucket = byCluster.get(key) ?? [];
    bucket.push(row);
    byCluster.set(key, bucket);
  }

  const summaries: RedditClusterSummary[] = [];

  for (const [clusterId, members] of byCluster) {
    const statusCounts = emptyStatusCounts();
    let sumScore = 0;
    let sumComments = 0;
    let growthSum = 0;
    let growthParts = 0;
    let lastSeenAt = '';
    const topicSet = new Set<string>();
    const subredditSet = new Set<RedditSignalAdminRow['subreddit']>();
    let topPost: RedditClusterSummary['topPost'] = null;
    let topEngagement = -1;

    for (const row of members) {
      sumScore += row.score;
      sumComments += row.numComments;
      statusCounts[row.status] += 1;
      if (row.topic?.trim()) topicSet.add(row.topic.trim());
      subredditSet.add(row.subreddit);
      if (row.growth24h !== null) {
        growthSum += row.growth24h;
        growthParts += 1;
      }
      if (!lastSeenAt || row.lastSeenAt > lastSeenAt) {
        lastSeenAt = row.lastSeenAt;
      }
      if (row.engagement > topEngagement) {
        topEngagement = row.engagement;
        topPost = {
          id: row.id,
          title: row.title,
          score: row.score,
          numComments: row.numComments,
          url: row.url,
          subreddit: row.subreddit,
        };
      }
    }

    const growth24h = growthParts > 0 ? Math.round(growthSum) : null;

    summaries.push({
      clusterId,
      postCount: members.length,
      sumScore,
      sumComments,
      growth24h,
      topPost,
      topics: [...topicSet].sort((a, b) => a.localeCompare(b, 'nb')),
      subreddits: [...subredditSet].sort((a, b) => a.localeCompare(b, 'nb')),
      statusCounts,
      lastSeenAt,
    });
  }

  return summaries;
}

export function countUnclusteredSignals(rows: RedditSignalAdminRow[]): number {
  return rows.filter((row) => !row.clusterId?.trim()).length;
}