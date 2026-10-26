import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isActivePollGeneration,
  loadStateAfterDialogClose,
  refetchOnNextOpenAfterClose,
  shouldRefetchOnDialogOpen,
} from '@/lib/ai-summary/sak-summary-dialog-state';

assert.equal(loadStateAfterDialogClose(true, 'ready'), 'ready');
assert.equal(loadStateAfterDialogClose(true, 'read_failed'), 'idle');
assert.equal(loadStateAfterDialogClose(false, 'timeout'), 'idle');
assert.equal(loadStateAfterDialogClose(true, 'loading'), 'ready');

assert.equal(refetchOnNextOpenAfterClose(true, 'ready'), false);
assert.equal(refetchOnNextOpenAfterClose(true, 'read_failed'), true);
assert.equal(refetchOnNextOpenAfterClose(false, 'ready'), true);

assert.equal(shouldRefetchOnDialogOpen(true, false), false);
assert.equal(shouldRefetchOnDialogOpen(true, true), true);
assert.equal(shouldRefetchOnDialogOpen(false, false), true);

assert.equal(isActivePollGeneration(2, 2), true);
assert.equal(isActivePollGeneration(2, 3), false);

const uiSrc = readFileSync(
  join(process.cwd(), 'app/dashboard/sak/[id]/ai-summary.tsx'),
  'utf8',
);
assert.match(uiSrc, /loadStateAfterDialogClose/);
assert.match(uiSrc, /refetchOnNextOpenAfterClose/);
assert.match(uiSrc, /pollGenerationRef/);
assert.doesNotMatch(uiSrc, /closeSummary[\s\S]*?setData\(null\)/);
assert.match(uiSrc, /role="status"/);
assert.match(uiSrc, /AlertCircle/);

console.log('ai-summary/sak-summary-dialog-state.test.ts: ok');
