import assert from 'node:assert/strict';
import { parseGaveUpRows } from '@/lib/content-feedback/ai-summary-queue-parse';

const rows = parseGaveUpRows([
  {
    issue_id: '12345',
    title: 'Test',
    kind: 'regenerering',
    attempts: 5,
    last_attempt_at: '2026-01-01T00:00:00Z',
  },
]);
assert.equal(rows.length, 1);
assert.equal(rows[0]?.issue_id, '12345');

assert.equal(parseGaveUpRows('[]').length, 0);
assert.equal(parseGaveUpRows(null).length, 0);

console.log('content-feedback/ai-summary-queue-parse.test.ts: ok');
