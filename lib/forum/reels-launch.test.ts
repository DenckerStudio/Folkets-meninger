import assert from 'node:assert/strict';
import {
  REELS_PUBLIC_LAUNCH_MIN_ACTIVE,
  classifyReelDraft,
  computeReelsLaunchReadiness,
  sortDraftsForPublishPriority,
} from './reels-launch';

assert.equal(REELS_PUBLIC_LAUNCH_MIN_ACTIVE, 8);

const grounded = {
  id: '1',
  stortinget_issue_id: '200001',
  generation_metadata: { source_type: 'stortinget_sak', rag_chunk_count: 4 },
  created_at: '2026-01-01T00:00:00.000Z',
};
const thinSak = {
  id: '2',
  stortinget_issue_id: '200002',
  generation_metadata: { source_type: 'stortinget_sak', rag_chunk_count: 0 },
  created_at: '2026-01-02T00:00:00.000Z',
};
const rss = {
  id: '3',
  generation_metadata: { source_type: 'rss' },
  created_at: '2026-01-03T00:00:00.000Z',
};
const other = {
  id: '4',
  generation_metadata: { source_type: 'trending' },
  created_at: '2026-01-04T00:00:00.000Z',
};

assert.equal(classifyReelDraft(grounded), 'v13_grounded');
assert.equal(classifyReelDraft(thinSak), 'v13_thin');
assert.equal(classifyReelDraft(rss), 'v12_rss');
assert.equal(classifyReelDraft(other), 'other');

const sorted = sortDraftsForPublishPriority([other, rss, thinSak, grounded]);
assert.deepEqual(
  sorted.map((d) => d.id),
  ['1', '2', '3', '4'],
);

const readiness = computeReelsLaunchReadiness({
  activeCount: 3,
  drafts: [grounded, rss, other],
  pendingWithRag: 12,
  sakCandidates: 5,
});
assert.equal(readiness.groundedV13Drafts, 1);
assert.equal(readiness.v12Drafts, 1);
assert.equal(readiness.otherDrafts, 1);
assert.equal(readiness.readyForPublic, false);

const ready = computeReelsLaunchReadiness({
  activeCount: 8,
  drafts: [],
});
assert.equal(ready.readyForPublic, true);

console.log('reels-launch.test.ts: ok');
