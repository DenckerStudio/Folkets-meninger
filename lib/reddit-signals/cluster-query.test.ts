import assert from 'node:assert/strict';
import {
  buildRedditTemaerAdminPath,
  buildRedditTemaerQueryString,
  parseRedditClusterFilters,
} from '@/lib/reddit-signals/cluster-query';
import { isRedditTemaerView } from '@/lib/reddit-signals/research-view';

const filters = parseRedditClusterFilters({
  view: 'temaer',
  subreddit: 'norske',
  topic: 'strøm',
  minPosts: '2',
  sort: 'growth24h',
});
assert.equal(filters.subreddit, 'norske');
assert.equal(filters.minPosts, 2);
assert.equal(filters.sort, 'growth24h');

assert.equal(isRedditTemaerView({ view: 'temaer' }), true);
assert.equal(isRedditTemaerView({ view: 'signaler' }), false);

const qs = buildRedditTemaerQueryString(filters);
assert.match(qs, /view=temaer/);
assert.match(qs, /sort=growth24h/);

assert.equal(
  buildRedditTemaerAdminPath(filters),
  `/dashboard/admin/research?${buildRedditTemaerQueryString(filters)}`,
);

console.log('lib/reddit-signals/cluster-query.test.ts: ok');