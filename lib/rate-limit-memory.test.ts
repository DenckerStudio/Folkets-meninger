import assert from 'node:assert/strict';
import { checkRateLimitMemory } from '@/lib/rate-limit-memory';

const key = `test-${Date.now()}`;
const first = checkRateLimitMemory(key, 2, 60_000);
assert.equal(first.ok, true);
const second = checkRateLimitMemory(key, 2, 60_000);
assert.equal(second.ok, true);
const third = checkRateLimitMemory(key, 2, 60_000);
assert.equal(third.ok, false);
if (!third.ok) {
  assert.ok(third.retryAfterSeconds >= 1);
}

console.log('rate-limit-memory.test.ts: ok');
