import assert from 'node:assert/strict';
import {
  buildResearchTableMenuItem,
  getResearchTableMenuItems,
} from '@/components/admin/research-row-actions';
import type { ResearchBriefsByKind } from '@/lib/admin/research/service';

const clusterId = 'cluster-test-1';

const emptyBriefs: ResearchBriefsByKind = {};

assert.equal(getResearchTableMenuItems(emptyBriefs, clusterId).length, 3);

const labels = getResearchTableMenuItems(emptyBriefs, clusterId).map((item) => item.label);
assert.ok(labels.includes('Utdyp research'), 'forvent utdyp-handling uten brief');
assert.ok(labels.includes('Lag blogginnlegg'), 'forvent blogg-handling uten brief');
assert.ok(labels.includes('Lag Reel'), 'forvent reel-handling uten brief');

const queued = buildResearchTableMenuItem('blog', {
  kind: 'blog',
  status: 'queued',
  output_ref: null,
  request_id: 'req-1',
});
assert.equal(queued.disabled, true);
assert.match(queued.label, /I kø/);

const failed = buildResearchTableMenuItem('reel', {
  kind: 'reel',
  status: 'failed',
  output_ref: null,
  request_id: 'req-2',
});
assert.equal(failed.destructive, true);
assert.match(failed.label, /feilet/i);

console.log('table-menu-items.test.ts: ok');
