import assert from 'node:assert/strict';
import {
  createTier0ProbeCacheState,
  isTier0ProbeCacheFresh,
  recordTier0ProbeSuccess,
  resolveTier0ProbeError,
  TIER0_PROBE_CACHE_TTL_MS,
  hasTier0FromRpcRows,
} from './tier0-probe-cache';

const state = createTier0ProbeCacheState();
assert.equal(isTier0ProbeCacheFresh(state, 0), false);

recordTier0ProbeSuccess(state, true, 1000);
assert.equal(isTier0ProbeCacheFresh(state, 1000 + TIER0_PROBE_CACHE_TTL_MS - 1), true);
assert.equal(isTier0ProbeCacheFresh(state, 1000 + TIER0_PROBE_CACHE_TTL_MS), false);

const logs: string[] = [];
const fallbackFalse = resolveTier0ProbeError(
  createTier0ProbeCacheState(),
  { message: 'timeout', code: '57014', details: null, hint: null },
  (line) => logs.push(line),
);
assert.equal(fallbackFalse, false);
assert.match(logs[0]!, /tier0-probe feilet/);
assert.match(logs[0]!, /timeout/);
assert.match(logs[0]!, /code=57014/);

const staleState = createTier0ProbeCacheState();
recordTier0ProbeSuccess(staleState, true, 0);
assert.equal(
  resolveTier0ProbeError(staleState, new Error('nettverk'), (line) => logs.push(line)),
  true,
);

assert.equal(hasTier0FromRpcRows([{ issue_id: 'x' }]), true);
assert.equal(hasTier0FromRpcRows([]), false);
assert.equal(hasTier0FromRpcRows(null), false);

console.log('lib/backfill-embedding-v2/tier0-probe-cache.test.ts: ok');
