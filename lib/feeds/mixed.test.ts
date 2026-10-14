import assert from 'node:assert/strict';
import { interleaveEvenly, interleaveEvery, rotateToMatch } from './mixed';

assert.deepEqual(interleaveEvery([1, 2, 3, 4, 5], ['a', 'b'], 2), [1, 2, 'a', 3, 4, 'b', 5]);
assert.deepEqual(interleaveEvery([1, 2, 3], [], 2), [1, 2, 3]);
assert.deepEqual(interleaveEvery([1, 2, 3], ['a'], 0), [1, 2, 3]);
assert.deepEqual(interleaveEvery([1, 2, 3, 4], ['a', 'b', 'c'], 1), [1, 'a', 2, 'b', 3, 'c', 4]);

// Promos must still appear on short feeds where `interleaveEvery(..., 4)` never would.
assert.deepEqual(interleaveEvenly([1, 2, 3], ['a']), [1, 'a', 2, 3]);
assert.deepEqual(interleaveEvenly([1], ['a']), [1, 'a']);
assert.deepEqual(interleaveEvenly([1, 2, 3, 4, 5, 6, 7, 8], ['a', 'b']), [
  1, 2, 'a', 3, 4, 5, 'b', 6, 7, 8,
]);
assert.deepEqual(interleaveEvenly([1, 2, 3], []), [1, 2, 3]);
assert.deepEqual(interleaveEvenly([], ['a']), ['a']);
// More inserts than items: every insert is still emitted, never before the first item.
assert.deepEqual(interleaveEvenly([1], ['a', 'b']), [1, 'a', 'b']);
assert.deepEqual(interleaveEvenly([1, 2], ['a', 'b', 'c']), [1, 'a', 'b', 'c', 2]);

assert.deepEqual(rotateToMatch([1, 2, 3], (value) => value === 3), [3, 1, 2]);
assert.deepEqual(rotateToMatch([1, 2, 3], (value) => value === 1), [1, 2, 3]);
assert.deepEqual(rotateToMatch([1, 2, 3], (value) => value === 9), [1, 2, 3]);

console.log('lib/feeds/mixed.test.ts passed');
