import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  classifySakSummaryHttpResponse,
  parseReadySakSummary,
  retryAfterSeconds,
  SAK_SUMMARY_READ_FAILED_MESSAGE,
  SAK_SUMMARY_TIMEOUT_MESSAGE,
} from '@/lib/ai-summary/sak-summary-fetch';

assert.equal(
  classifySakSummaryHttpResponse(503, { status: 'read_failed', retry_after_seconds: 15 }),
  'read_failed',
);
assert.equal(classifySakSummaryHttpResponse(202, { status: 'pending' }), 'pending');
assert.equal(classifySakSummaryHttpResponse(500, { error: 'x' }), 'unexpected');

const ready = parseReadySakSummary({
  version: 2,
  narrative: 'Tekst',
  who_affected: '',
  how_affected: '',
  forslag: [],
  topic_cards: [],
  labels: [],
});
assert.ok(ready?.version === 2);

assert.equal(retryAfterSeconds({ retry_after_seconds: 30 }), 30);
assert.equal(retryAfterSeconds({}), 15);

const uiSrc = readFileSync(
  join(process.cwd(), 'app/dashboard/sak/[id]/ai-summary.tsx'),
  'utf8',
);
assert.match(uiSrc, /SAK_SUMMARY_READ_FAILED_MESSAGE/);
assert.match(uiSrc, /Prøv igjen/);
assert.match(uiSrc, /SAK_SUMMARY_TIMEOUT_MESSAGE/);
assert.match(uiSrc, /classifySakSummaryHttpResponse/);
assert.match(uiSrc, /loadState === 'read_failed'/);

console.log('ai-summary/sak-summary-fetch.test.ts: ok', {
  readFailed: SAK_SUMMARY_READ_FAILED_MESSAGE.slice(0, 24),
  timeout: SAK_SUMMARY_TIMEOUT_MESSAGE,
});
