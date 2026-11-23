import assert from 'node:assert/strict';

import {
  clearOverviewInflightForTests,
  coalesceOverviewCacheLoad,
  hasOverviewInflightForTests,
} from '@/lib/admin/local-ai-hub/overview-cache-inflight';

async function runOverviewInflightTests(): Promise<void> {
  clearOverviewInflightForTests();

  let runs = 0;
  const delayed = (ms: number, value: number) =>
    new Promise<number>((resolve) => {
      setTimeout(() => {
        runs += 1;
        resolve(value);
      }, ms);
    });

  const first = coalesceOverviewCacheLoad(() => delayed(40, 1));
  const second = coalesceOverviewCacheLoad(() => delayed(5, 2));
  assert.equal(hasOverviewInflightForTests(), true);

  const [a, b] = await Promise.all([first, second]);
  assert.equal(a, 1);
  assert.equal(b, 1);
  assert.equal(runs, 1);
  assert.equal(hasOverviewInflightForTests(), false);

  clearOverviewInflightForTests();
}

runOverviewInflightTests()
  .then(() => {
    console.log('lib/admin/local-ai-hub/overview-cache-inflight.test.ts: ok');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });