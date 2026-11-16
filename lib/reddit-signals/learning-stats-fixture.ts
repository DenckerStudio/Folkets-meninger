import type { RedditLearningStatRow } from '@/lib/reddit-signals/cluster-types';

/** Fixture for skjermbilder (`?view=temaer&preview=fixture`). */
export function buildRedditLearningStatsFixture(): RedditLearningStatRow[] {
  return [
    {
      dimension: 'subreddit',
      groupKey: 'norge',
      total: 120,
      brukt: 42,
      ignorert: 55,
      autoIgnorert: 18,
      blokkert: 5,
      avgAiRelevance: 3.4,
      bruktRate: 0.35,
    },
    {
      dimension: 'topic',
      groupKey: 'strøm',
      total: 38,
      brukt: 12,
      ignorert: 20,
      autoIgnorert: 5,
      blokkert: 1,
      avgAiRelevance: 3.8,
      bruktRate: 12 / 38,
    },
    {
      dimension: 'link_domain',
      groupKey: 'nrk.no',
      total: 64,
      brukt: 28,
      ignorert: 30,
      autoIgnorert: 4,
      blokkert: 2,
      avgAiRelevance: 4.1,
      bruktRate: 0.4375,
    },
  ];
}