import assert from 'node:assert/strict';
import { interleaveEvery, rotateToMatch } from './mixed';

assert.deepEqual(interleaveEvery([1, 2, 3, 4, 5], ['a', 'b'], 2), [1, 2, 'a', 3, 4, 'b', 5]);
assert.deepEqual(interleaveEvery([1, 2, 3], [], 2), [1, 2, 3]);
assert.deepEqual(interleaveEvery([1, 2, 3], ['a'], 0), [1, 2, 3]);
assert.deepEqual(interleaveEvery([1, 2, 3, 4], ['a', 'b', 'c'], 1), [1, 'a', 2, 'b', 3, 'c', 4]);

assert.deepEqual(rotateToMatch([1, 2, 3], (value) => value === 3), [3, 1, 2]);
assert.deepEqual(rotateToMatch([1, 2, 3], (value) => value === 1), [1, 2, 3]);
assert.deepEqual(rotateToMatch([1, 2, 3], (value) => value === 9), [1, 2, 3]);

console.log('lib/feeds/mixed.test.ts passed');
