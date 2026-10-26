import assert from 'node:assert/strict';
import {
  sortPendingEmbeddingIssuesNewestFirst,
  type PendingEmbeddingIssue,
} from './legacy-embedding-pending-issues';

const rows: PendingEmbeddingIssue[] = [
  { issueId: '103100', lastSyncedAtMs: 1_000 },
  { issueId: '200500', lastSyncedAtMs: 3_000 },
  { issueId: '200400', lastSyncedAtMs: 3_000 },
];

assert.deepEqual(sortPendingEmbeddingIssuesNewestFirst(rows), ['200500', '200400', '103100']);

console.log('legacy-embedding-pending-issues.test.ts: ok');
