import type { RedditSignalSubreddit } from '@/lib/admin/oppfanget/types';
import type { SpikeBadgeFocus } from '@/lib/reddit-signals/spike-badge';

export const REDDIT_SIGNAL_STATUSES = [
  'ny',
  'brukt',
  'ignorert',
  'auto_ignorert',
  'blokkert',
] as const;

export type RedditSignalStatus = (typeof REDDIT_SIGNAL_STATUSES)[number];

export const REDDIT_SIGNAL_SORT_KEYS = [
  'score',
  'comments',
  'contention',
  'relevance',
  'engagement',
  'growth24h',
] as const;

export type RedditSignalSortKey = (typeof REDDIT_SIGNAL_SORT_KEYS)[number];

export const REDDIT_SIGNAL_API_ACTIONS = ['ignorer', 'blokker', 'marker_brukt'] as const;

export type RedditSignalApiAction = (typeof REDDIT_SIGNAL_API_ACTIONS)[number];

export type RedditSignalSnapshotPoint = {
  capturedAt: string;
  score: number;
  numComments: number;
  numCrossposts: number | null;
};

export type RedditSignalAdminRow = {
  id: string;
  redditId: string;
  subreddit: RedditSignalSubreddit;
  title: string;
  url: string;
  score: number;
  numComments: number;
  contention: number;
  numCrossposts: number | null;
  upvoteRatio: number | null;
  postedAt: string;
  snapshotAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  topic: string | null;
  relatedIssueId: string | null;
  relatedIssueTitle: string | null;
  removalType: string | null;
  flair: string | null;
  aiRelevance: number | null;
  aiReason: string | null;
  clusterId: string | null;
  status: RedditSignalStatus;
  statusReason: string | null;
  researchTopicId: string | null;
  /** Sak fra research_topics.stortinget_issue_id (filter «kun med sak»). */
  linkedSakViaTopic: boolean;
  stortingetIssueId: string | null;
  engagement: number;
  growth24h: number | null;
  snapshots: RedditSignalSnapshotPoint[];
};

export type RedditSignalListFilters = {
  subreddit: RedditSignalSubreddit | '';
  topic: string;
  cluster: string;
  minScore: number | null;
  minComments: number | null;
  minRelevance: number | null;
  status: RedditSignalStatus | '';
  hideRemoved: boolean;
  onlyWithSakLink: boolean;
  spikeFocus: SpikeBadgeFocus | null;
  sort: RedditSignalSortKey;
};

export type RedditSignalListResponse = {
  rows: RedditSignalAdminRow[];
  total: number;
  filteredTotal: number;
  previewFixture: boolean;
  tableMissing: boolean;
  tableMissingMessage: string | null;
};