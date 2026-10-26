import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shouldTriggerMissingSummaryWebhook } from '@/lib/ai-summary/webhook-eligibility';

assert.equal(shouldTriggerMissingSummaryWebhook({ code: '42501' }, null), false);
assert.equal(shouldTriggerMissingSummaryWebhook(null, { stortinget_issue_id: '1' }), false);
assert.equal(shouldTriggerMissingSummaryWebhook(null, null), true);

const cacheSrc = readFileSync(join(process.cwd(), 'lib/stortinget-detail-cache.ts'), 'utf8');
assert.match(cacheSrc, /shouldTriggerMissingSummaryWebhook/);
assert.match(cacheSrc, /summaryReadError/);

console.log('ai-summary/webhook-eligibility.test.ts: ok');
