import assert from 'node:assert/strict';
import { mapRedditClusterStatsRow } from '@/lib/reddit-signals/cluster-db-map';

const mapped = mapRedditClusterStatsRow({
  cluster_id: 'klynge-1',
  post_count: 3,
  sum_score: 100,
  sum_comments: 40,
  growth_24h: 12,
  last_seen_at: '2026-01-01T00:00:00.000Z',
  status_ny: 1,
  status_brukt: 2,
  status_ignorert: 0,
  status_auto_ignorert: 0,
  status_blokkert: 0,
  topics: ['strøm', 'skatt'],
  subreddits: ['norge', 'norske'],
  top_post_id: '00000000-0000-4000-8000-000000000101',
  top_post_title: 'Tittel',
  top_post_url: 'https://www.reddit.com/comments/abc123/',
  top_post_score: 50,
  top_post_num_comments: 20,
  top_post_subreddit: 'norge',
});

assert.equal(mapped.clusterId, 'klynge-1');
assert.equal(mapped.postCount, 3);
assert.equal(mapped.statusCounts.brukt, 2);
assert.equal(mapped.topPost?.title, 'Tittel');

console.log('lib/reddit-signals/cluster-db-map.test.ts: ok');