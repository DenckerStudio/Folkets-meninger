import assert from 'node:assert/strict';
import {
  RESEARCH_JOB_SLOW_NOTICE_MS,
  researchJobAgeAnchorIso,
  shouldShowResearchJobSlowNotice,
  shouldShowResearchRowSlowNotice,
} from '@/lib/admin/research/slow-job-notice';

assert.equal(RESEARCH_JOB_SLOW_NOTICE_MS, 3 * 60 * 1000);

const base = '2026-11-02T12:00:00.000Z';
const now = Date.parse(base) + RESEARCH_JOB_SLOW_NOTICE_MS;

assert.equal(researchJobAgeAnchorIso({ created_at: base, updated_at: '2026-11-02T13:00:00.000Z' }), base);

assert.equal(
  shouldShowResearchJobSlowNotice({ status: 'queued', created_at: base }, now - 1),
  false,
);
assert.equal(
  shouldShowResearchJobSlowNotice({ status: 'queued', created_at: base }, now),
  true,
);
assert.equal(
  shouldShowResearchJobSlowNotice({ status: 'running', created_at: base }, now),
  true,
);
assert.equal(
  shouldShowResearchJobSlowNotice({ status: 'done', created_at: base }, now),
  false,
);
assert.equal(
  shouldShowResearchJobSlowNotice({ status: 'queued', updated_at: base }, now),
  true,
);
assert.equal(shouldShowResearchJobSlowNotice({ status: 'queued' }, now), false);

assert.equal(
  shouldShowResearchRowSlowNotice(
    [{ status: 'failed', created_at: base }, { status: 'running', created_at: base }],
    now,
  ),
  true,
);

console.log('slow-job-notice.test.ts: ok');
