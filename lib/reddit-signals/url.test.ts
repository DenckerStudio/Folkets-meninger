import assert from 'node:assert/strict';
import { buildRedditCommentsUrl, isValidRedditId } from '@/lib/reddit-signals/url';

assert.equal(isValidRedditId('abc123'), true);
assert.equal(isValidRedditId('BAD'), false);
assert.equal(buildRedditCommentsUrl('abc123'), 'https://www.reddit.com/comments/abc123/');

console.log('lib/reddit-signals/url.test.ts: ok');
