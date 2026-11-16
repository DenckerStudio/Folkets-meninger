import type { RedditClusterSortKey } from '@/lib/reddit-signals/cluster-types';
import type { RedditLearningStatDimension } from '@/lib/reddit-signals/cluster-types';

export const REDDIT_CLUSTER_SORT_LABELS: Record<RedditClusterSortKey, string> = {
  posts: 'Antall innlegg',
  score: 'Sum poeng',
  comments: 'Sum kommentarer',
  growth24h: 'Vekst 24 t',
  last_seen: 'Sist sett',
};

export const REDDIT_LEARNING_DIMENSION_LABELS: Record<RedditLearningStatDimension, string> = {
  subreddit: 'Subreddit',
  topic: 'Tema',
  link_domain: 'Lenkedomen',
};