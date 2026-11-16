import assert from 'node:assert/strict';
import { buildRedditSignalsFixtureList } from '@/lib/reddit-signals/mock-fixture';
import { filterRedditSignalRows, sortRedditSignalRows } from '@/lib/reddit-signals/sort-filter';
import type { RedditSignalListFilters } from '@/lib/reddit-signals/types';

const { rows } = buildRedditSignalsFixtureList();

const defaults: RedditSignalListFilters = {
  subreddit: '',
  topic: '',
  cluster: '',
  minScore: null,
  minComments: null,
  minRelevance: null,
  status: '',
  hideRemoved: false,
  onlyWithSakLink: false,
  spikeFocus: null,
  sort: 'engagement',
};

assert.equal(filterRedditSignalRows(rows, defaults).length, 4);
assert.equal(
  filterRedditSignalRows(rows, { ...defaults, cluster: 'fixture-klynge-a' }).length,
  3,
);
assert.equal(
  filterRedditSignalRows(rows, { ...defaults, hideRemoved: true }).length,
  3,
);
assert.equal(
  filterRedditSignalRows(rows, { ...defaults, onlyWithSakLink: true }).length,
  1,
);
assert.equal(
  filterRedditSignalRows(rows, {
    ...defaults,
    spikeFocus: { kind: 'post', redditId: 'fixture01' },
  }).length,
  1,
);

const byScore = sortRedditSignalRows(rows, 'score');
assert.equal(byScore[0]?.redditId, 'fixture02');

const byGrowth = sortRedditSignalRows(rows, 'growth24h');
assert.equal(byGrowth[0]?.redditId, 'fixture01');
assert.equal(byGrowth.at(-1)?.growth24h, null);

console.log('lib/reddit-signals/sort-filter.test.ts: ok');