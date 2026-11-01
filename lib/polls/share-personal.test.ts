import assert from 'node:assert/strict';
import { personalSharePath, resolveShareTarget } from '@/lib/polls/share-personal';

const pollPath = resolveShareTarget('poll', 'abc-123');
assert.equal(pollPath, '/del/abc-123');
assert.ok(pollPath?.startsWith('/'));
assert.equal(pollPath?.includes('//'), false);

const blogPath = resolveShareTarget('blog_post', 'min-sak');
assert.equal(blogPath, '/blogg/min-sak');
assert.ok(blogPath?.startsWith('/'));
assert.equal(blogPath?.includes('//'), false);

const sakPath = resolveShareTarget('sak', '12345');
assert.equal(sakPath, '/dashboard/sak/12345');
assert.ok(sakPath?.startsWith('/'));
assert.equal(sakPath?.includes('//'), false);

assert.equal(resolveShareTarget('generic', 'kampanje'), null);
assert.equal(resolveShareTarget('https://evil', 'abc'), null);
assert.equal(resolveShareTarget('poll', 'https://evil'), null);
assert.equal(resolveShareTarget('poll', '../'), null);
assert.equal(resolveShareTarget('poll', '..'), null);
assert.equal(resolveShareTarget('poll', '.'), null);
assert.equal(resolveShareTarget('sak', 'a..b'), null);
assert.equal(resolveShareTarget('unknown', 'abc'), null);

assert.equal(personalSharePath('abc 123'), '/l/abc%20123');
assert.equal(personalSharePath('a/b'), '/l/a%2Fb');
assert.ok(personalSharePath('abc').startsWith('/'));
assert.equal(personalSharePath('abc').includes('//'), false);

console.log('lib/polls/share-personal.test.ts: ok');
