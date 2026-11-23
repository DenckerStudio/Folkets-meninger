import assert from 'node:assert/strict';

import {
  clearInactiveFinishedRowCacheForTests,
  isPermanentlyCacheableFinishedRow,
  mergeInactiveFinishedRowFromCache,
  readInactiveFinishedRowCache,
  writeInactiveFinishedRowCache,
} from '@/lib/admin/local-ai-hub/inactive-finished-row-cache';
import type { LocalAiFinishedRow } from '@/lib/admin/local-ai-hub/overview-types';

function row(overrides: Partial<LocalAiFinishedRow>): LocalAiFinishedRow {
  return {
    taskId: 1,
    title: 'Oppgave',
    failed: false,
    failureComment: null,
    pr: {
      number: 10,
      url: 'https://example.com/pr/10',
      state: 'closed',
      merged: true,
      headSha: 'sha',
      headRef: 'branch',
      mergeable: false,
    },
    prError: null,
    ci: null,
    ciError: null,
    pixel: 'unknown',
    friction: 'unknown',
    merge: { canMerge: false, reasons: ['Pull request er ikke åpen'] },
    ...overrides,
  };
}

clearInactiveFinishedRowCacheForTests();
assert.equal(isPermanentlyCacheableFinishedRow(row({ pr: { ...row({}).pr!, state: 'open', merged: false } })), false);
assert.equal(isPermanentlyCacheableFinishedRow(row({})), true);

writeInactiveFinishedRowCache(42, row({ taskId: 42 }));
assert.ok(readInactiveFinishedRowCache(42));

const merged = mergeInactiveFinishedRowFromCache(row({ taskId: 42 }), { id: 42, title: 'Ny tittel' }, true, 'feil');
assert.equal(merged.title, 'Ny tittel');
assert.equal(merged.failed, true);
assert.equal(merged.failureComment, 'feil');
assert.equal(merged.pr?.number, 10);

clearInactiveFinishedRowCacheForTests();
console.log('lib/admin/local-ai-hub/inactive-finished-row-cache.test.ts: ok');