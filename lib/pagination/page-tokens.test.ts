import assert from 'node:assert/strict';
import { getPageTokens } from '@/lib/pagination/page-tokens';

assert.deepEqual(getPageTokens(1, 3), [1, 2, 3]);
assert.deepEqual(getPageTokens(5, 10), [1, 'gap', 4, 5, 6, 'gap', 10]);

console.log('lib/pagination/page-tokens.test.ts: ok');