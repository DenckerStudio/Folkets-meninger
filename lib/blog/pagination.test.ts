import assert from 'node:assert/strict';
import { isBlogPageOutOfRange } from '@/lib/blog/pagination';

assert.equal(isBlogPageOutOfRange(99, 0), true);
assert.equal(isBlogPageOutOfRange(1, 0), false);
assert.equal(isBlogPageOutOfRange(2, 0), true);
assert.equal(isBlogPageOutOfRange(3, 2), true);
assert.equal(isBlogPageOutOfRange(2, 2), false);

console.log('lib/blog/pagination.test.ts ok');
