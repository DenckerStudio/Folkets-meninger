import type { RedditSignalSubreddit } from '@/lib/admin/oppfanget/types';
import type { RedditSignalStatus } from '@/lib/reddit-signals/types';

export const REDDIT_CLUSTER_SORT_KEYS = [
  'posts',
  'score',
  'comments',
  'growth24h',
  'last_seen',
] as const;

export type RedditClusterSortKey = (typeof REDDIT_CLUSTER_SORT_KEYS)[number];

export type RedditClusterListFilters = {
  subreddit: RedditSignalSubreddit | '';
  topic: string;
  minPosts: number | null;
  sort: RedditClusterSortKey;
};

export type RedditClusterStatusCounts = Record<RedditSignalStatus, number>;

export type RedditClusterTopPost = {
  id: string;
  title: string;
  score: number;
  numComments: number;
  url: string;
  subreddit: RedditSignalSubreddit;
};

export type RedditClusterSummary = {
  clusterId: string;
  postCount: number;
  sumScore: number;
  sumComments: number;
  growth24h: number | null;
  topPost: RedditClusterTopPost | null;
  topics: string[];
  subreddits: RedditSignalSubreddit[];
  statusCounts: RedditClusterStatusCounts;
  lastSeenAt: string;
};

export type RedditClusterListResponse = {
  clusters: RedditClusterSummary[];
  totalClusters: number;
  filteredTotal: number;
  unclusteredCount: number;
  previewFixture: boolean;
  tableMissing: boolean;
  tableMissingMessage: string | null;
};

export const REDDIT_LEARNING_STAT_DIMENSIONS = ['subreddit', 'topic', 'link_domain'] as const;

export type RedditLearningStatDimension = (typeof REDDIT_LEARNING_STAT_DIMENSIONS)[number];

export type RedditLearningStatRow = {
  dimension: RedditLearningStatDimension;
  groupKey: string;
  total: number;
  brukt: number;
  ignorert: number;
  autoIgnorert: number;
  blokkert: number;
  avgAiRelevance: number | null;
  bruktRate: number | null;
};

export type RedditLearningStatsResponse = {
  rows: RedditLearningStatRow[];
  viewMissing: boolean;
  viewMissingMessage: string | null;
};