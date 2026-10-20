import assert from 'node:assert/strict';
import { RESEARCH_API_ERROR_CODES } from '@/lib/admin/research/api-error-codes';
import {
  mergeActiveBriefFromConflict,
  resolveResearchEnqueueConflict,
} from '@/lib/admin/research/enqueue-response';

const fallback = 'Feil';

const requestConflict = resolveResearchEnqueueConflict(
  'deepen',
  { error: RESEARCH_API_ERROR_CODES.requestConflict },
  fallback,
);
assert.equal(requestConflict.kind, 'message_only');

const activeWithoutId = resolveResearchEnqueueConflict(
  'blog',
  { error: RESEARCH_API_ERROR_CODES.briefActive },
  fallback,
);
assert.equal(activeWithoutId.kind, 'message_only');

const activeWithId = resolveResearchEnqueueConflict(
  'reel',
  {
    error: RESEARCH_API_ERROR_CODES.briefActive,
    request_id: '11111111-1111-4111-8111-111111111111',
    status: 'running',
  },
  fallback,
);
assert.equal(activeWithId.kind, 'sync_active');
if (activeWithId.kind === 'sync_active') {
  assert.equal(activeWithId.status, 'running');
  const merged = mergeActiveBriefFromConflict({}, 'reel', activeWithId.requestId, 'running');
  assert.equal(merged.reel?.status, 'running');
}

console.log('admin/research/enqueue-response.test.ts: ok');
