import type { RedditSignalSubreddit } from '@/lib/admin/oppfanget/types';
import { REDDIT_SIGNAL_STATUSES, type RedditSignalStatus } from '@/lib/reddit-signals/types';
import type { RedditClusterSummary } from '@/lib/reddit-signals/cluster-types';

const SUBREDDITS: RedditSignalSubreddit[] = ['norge', 'norske', 'Nordmenn'];

function parseSubreddit(value: string): RedditSignalSubreddit | null {
  return SUBREDDITS.includes(value as RedditSignalSubreddit)
    ? (value as RedditSignalSubreddit)
    : null;
}

export type RedditClusterStatsDbRow = {
  cluster_id: string;
  post_count: number;
  sum_score: number;
  sum_comments: number;
  growth_24h: number | null;
  last_seen_at: string;
  status_ny: number;
  status_brukt: number;
  status_ignorert: number;
  status_auto_ignorert: number;
  status_blokkert: number;
  topics: string[] | null;
  subreddits: string[] | null;
  top_post_id: string | null;
  top_post_title: string | null;
  top_post_url: string | null;
  top_post_score: number | null;
  top_post_num_comments: number | null;
  top_post_subreddit: string | null;
};

export function mapRedditClusterStatsRow(row: RedditClusterStatsDbRow): RedditClusterSummary {
  const statusCounts = {} as Record<RedditSignalStatus, number>;
  for (const status of REDDIT_SIGNAL_STATUSES) {
    statusCounts[status] = 0;
  }
  statusCounts.ny = row.status_ny ?? 0;
  statusCounts.brukt = row.status_brukt ?? 0;
  statusCounts.ignorert = row.status_ignorert ?? 0;
  statusCounts.auto_ignorert = row.status_auto_ignorert ?? 0;
  statusCounts.blokkert = row.status_blokkert ?? 0;

  const subreddits = (row.subreddits ?? [])
    .map((s) => parseSubreddit(s))
    .filter((s): s is RedditSignalSubreddit => s !== null)
    .sort((a, b) => a.localeCompare(b, 'nb'));

  const topSub = row.top_post_subreddit ? parseSubreddit(row.top_post_subreddit) : null;

  const topPost =
    row.top_post_id && row.top_post_title && row.top_post_url && topSub
      ? {
          id: row.top_post_id,
          title: row.top_post_title,
          url: row.top_post_url,
          score: row.top_post_score ?? 0,
          numComments: row.top_post_num_comments ?? 0,
          subreddit: topSub,
        }
      : null;

  return {
    clusterId: row.cluster_id,
    postCount: row.post_count,
    sumScore: row.sum_score,
    sumComments: row.sum_comments,
    growth24h: row.growth_24h,
    topPost,
    topics: [...(row.topics ?? [])].sort((a, b) => a.localeCompare(b, 'nb')),
    subreddits,
    statusCounts,
    lastSeenAt: row.last_seen_at,
  };
}