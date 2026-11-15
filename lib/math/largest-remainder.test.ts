import assert from 'node:assert/strict';
import { largestRemainderPercents } from './largest-remainder';

assert.deepEqual(largestRemainderPercents([1, 1, 1]), [34, 33, 33]);
assert.deepEqual(largestRemainderPercents([33, 33, 34]), [33, 33, 34]);
assert.equal(largestRemainderPercents([0, 0, 0]).reduce((a, b) => a + b, 0), 0);
assert.equal(largestRemainderPercents([10, 20, 70]).reduce((a, b) => a + b, 0), 100);

console.log('lib/math/largest-remainder.test.ts: ok');