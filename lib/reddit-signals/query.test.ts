import assert from 'node:assert/strict';
import {
  buildRedditSignalsAdminPath,
  buildRedditSignalsQueryString,
  isRedditSignalsView,
  parseRedditSignalsFilters,
} from '@/lib/reddit-signals/query';

const base = parseRedditSignalsFilters({});
assert.equal(base.sort, 'engagement');
assert.equal(base.hideRemoved, false);

const parsed = parseRedditSignalsFilters({
  view: 'signaler',
  subreddit: 'norge',
  topic: 'skatt',
  minScore: '50',
  minComments: '10',
  minRelevance: '3',
  status: 'ny',
  hideRemoved: '1',
  onlySak: 'true',
  spike: 'post:abc123',
  sort: 'growth24h',
});
assert.equal(parsed.subreddit, 'norge');
assert.equal(parsed.minScore, 50);
assert.equal(parsed.minRelevance, 3);
assert.equal(parsed.onlyWithSakLink, true);
assert.equal(parsed.spikeFocus?.redditId, 'abc123');
assert.equal(parsed.sort, 'growth24h');

assert.equal(isRedditSignalsView({ view: 'signaler' }), true);
assert.equal(isRedditSignalsView({}), false);

const qs = buildRedditSignalsQueryString(parsed);
assert.match(qs, /view=signaler/);
assert.match(qs, /sort=growth24h/);

assert.equal(
  buildRedditSignalsAdminPath(parsed),
  `/dashboard/admin/research?${buildRedditSignalsQueryString(parsed)}`,
);

console.log('lib/reddit-signals/query.test.ts: ok');