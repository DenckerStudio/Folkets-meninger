import assert from 'node:assert/strict';
import { loadWithOkOnlyCache } from '@/lib/sak/similar-issues-cache';
import type { SimilarSakerLoadResult } from '@/lib/sak/similar-issues-load';

/** Etterligner unstable_cache: lagrer bare verdier som løses, ikke kast. */
function createFakeCache() {
  let stored: SimilarSakerLoadResult | undefined;
  return (fn: () => Promise<SimilarSakerLoadResult>) => async () => {
    if (stored) return stored;
    const value = await fn();
    stored = value;
    return value;
  };
}

async function main() {
  const cache = createFakeCache();
  const okResult: SimilarSakerLoadResult = { status: 'ok', items: [] };

  const first = await loadWithOkOnlyCache(async () => ({ status: 'error' }), cache);
  assert.deepEqual(first, { status: 'error' }, 'feil skal gi error-status');

  const second = await loadWithOkOnlyCache(async () => okResult, cache);
  assert.deepEqual(second, okResult, 'feil skal ikke caches, neste oppslag skal hente på nytt');

  const third = await loadWithOkOnlyCache(async () => ({ status: 'error' }), cache);
  assert.deepEqual(third, okResult, 'vellykket resultat skal fortsatt caches');

  const throwing = await loadWithOkOnlyCache(async () => {
    throw new Error('rpc nede');
  }, createFakeCache());
  assert.deepEqual(throwing, { status: 'error' }, 'kast fra loader skal gi error-status');

  console.log('sak/similar-issues-cache.test.ts: ok feil caches ikke');
}

void main();
