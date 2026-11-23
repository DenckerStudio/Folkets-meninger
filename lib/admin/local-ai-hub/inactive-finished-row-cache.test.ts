import assert from 'node:assert/strict';

import {
  buildInactiveFinishedRowCacheKey,
  clearInactiveFinishedRowCacheForTests,
  isPermanentlyCacheableFinishedRow,
  mergeInactiveFinishedRowFromCache,
  readInactiveFinishedRowCache,
  writeInactiveFinishedRowCache,
} from '@/lib/admin/local-ai-hub/inactive-finished-row-cache';
import type { LocalAiFinishedRow } from '@/lib/admin/local-ai-hub/overview-types';
import type { ResolvedTaskPrLink } from '@/lib/admin/local-ai-hub/pr-link';

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

const linkPr10: ResolvedTaskPrLink = {
  mode: 'url',
  owner: 'DenckerStudio',
  repo: 'Folkets-meninger',
  number: 10,
  url: 'https://github.com/DenckerStudio/Folkets-meninger/pull/10',
};

const linkPr11: ResolvedTaskPrLink = {
  mode: 'url',
  owner: 'DenckerStudio',
  repo: 'Folkets-meninger',
  number: 11,
  url: 'https://github.com/DenckerStudio/Folkets-meninger/pull/11',
};

const linkBranch: ResolvedTaskPrLink = {
  mode: 'branch',
  owner: 'DenckerStudio',
  repo: 'Folkets-meninger',
  branch: 'cursor/task-42-foo',
};

clearInactiveFinishedRowCacheForTests();
assert.equal(isPermanentlyCacheableFinishedRow(row({ pr: { ...row({}).pr!, state: 'open', merged: false } })), false);
assert.equal(isPermanentlyCacheableFinishedRow(row({})), true);

assert.notEqual(
  buildInactiveFinishedRowCacheKey(42, linkPr10),
  buildInactiveFinishedRowCacheKey(42, linkPr11),
);

writeInactiveFinishedRowCache(42, linkPr10, row({ taskId: 42, pr: { ...row({}).pr!, number: 10 } }));
assert.ok(readInactiveFinishedRowCache(42, linkPr10));
assert.equal(readInactiveFinishedRowCache(42, linkPr11), null);
assert.equal(readInactiveFinishedRowCache(42, linkBranch), null);

const merged = mergeInactiveFinishedRowFromCache(row({ taskId: 42 }), { id: 42, title: 'Ny tittel' }, true, 'feil');
assert.equal(merged.title, 'Ny tittel');
assert.equal(merged.failed, true);
assert.equal(merged.failureComment, 'feil');
assert.equal(merged.pr?.number, 10);

clearInactiveFinishedRowCacheForTests();
console.log('lib/admin/local-ai-hub/inactive-finished-row-cache.test.ts: ok');
