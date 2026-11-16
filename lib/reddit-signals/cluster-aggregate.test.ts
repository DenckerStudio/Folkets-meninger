import assert from 'node:assert/strict';
import { aggregateRedditClusters, countUnclusteredSignals } from '@/lib/reddit-signals/cluster-aggregate';
import { buildRedditSignalsFixtureList } from '@/lib/reddit-signals/mock-fixture';
import { filterRedditClusters, sortRedditClusters } from '@/lib/reddit-signals/cluster-sort-filter';

const { rows } = buildRedditSignalsFixtureList();
const clusters = aggregateRedditClusters(rows);

assert.equal(countUnclusteredSignals(rows), 1);
assert.ok(clusters.some((c) => c.clusterId === 'fixture-klynge-a'));
const klyngeA = clusters.find((c) => c.clusterId === 'fixture-klynge-a');
assert.ok(klyngeA);
assert.equal(klyngeA?.postCount, 3);
assert.equal(klyngeA?.sumScore, 145 + 210 + 88);

const filtered = filterRedditClusters(clusters, {
  subreddit: 'norge',
  topic: '',
  minPosts: 2,
  sort: 'posts',
});
assert.ok(filtered.length >= 1);

const sorted = sortRedditClusters(clusters, 'posts');
assert.ok(sorted[0]!.postCount >= sorted.at(-1)!.postCount);

console.log('lib/reddit-signals/cluster-aggregate.test.ts: ok');