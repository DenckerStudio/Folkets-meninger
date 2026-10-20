import assert from 'node:assert/strict';
import {
  hasActiveResearchBriefs,
  isActiveResearchBriefStatus,
  RESEARCH_BRIEF_POLL_MS,
} from '@/lib/admin/research/polling';

assert.equal(RESEARCH_BRIEF_POLL_MS, 5000);
assert.equal(isActiveResearchBriefStatus('queued'), true);
assert.equal(isActiveResearchBriefStatus('running'), true);
assert.equal(isActiveResearchBriefStatus('done'), false);

assert.equal(hasActiveResearchBriefs({ deepen: { kind: 'deepen', status: 'running', request_id: 'a', output_ref: null } }), true);
assert.equal(hasActiveResearchBriefs({ blog: { kind: 'blog', status: 'failed', request_id: 'b', output_ref: null } }), false);

console.log('admin/research/polling.test.ts: ok');
