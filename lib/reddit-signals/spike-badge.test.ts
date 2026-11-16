import assert from 'node:assert/strict';
import {
  buildSpikeItemAdminHref,
  parseSpikeBadgeConfigValue,
  parseSpikeFocusParam,
  rowMatchesSpikeFocus,
  spikeFocusToQueryParam,
} from '@/lib/reddit-signals/spike-badge';

assert.equal(parseSpikeBadgeConfigValue(null), null);
assert.equal(parseSpikeBadgeConfigValue({ active: false, items: [] }), null);
assert.equal(parseSpikeBadgeConfigValue({ active: true }), null);

const parsed = parseSpikeBadgeConfigValue({
  active: true,
  items: [
    { kind: 'post', reddit_id: 'abc123', label: 'Testinnlegg' },
    'def456',
    { cluster_id: 'k1', label: 'Min klynge' },
    { kind: 'post', reddit_id: '!!!' },
  ],
});
assert.ok(parsed);
assert.equal(parsed!.items.length, 3);
assert.equal(parsed!.items[0]?.label, 'Testinnlegg');

const focus = parseSpikeFocusParam('post:abc123');
assert.ok(focus);
assert.equal(
  rowMatchesSpikeFocus(
    { id: 'u1', redditId: 'abc123', clusterId: null },
    focus,
  ),
  true,
);

assert.equal(spikeFocusToQueryParam({ kind: 'cluster', clusterId: 'k1' }), 'cluster:k1');
assert.match(buildSpikeItemAdminHref({ kind: 'post', redditId: 'abc123', label: 'x' }), /spike=post%3Aabc123/);

console.log('lib/reddit-signals/spike-badge.test.ts: ok');