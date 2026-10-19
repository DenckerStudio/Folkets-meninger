import assert from 'node:assert/strict';
import {
  BLOG_BLUESKY_MAX,
  BLOG_EXCERPT_MAX,
  graphemeCount,
  normalizeBlogExcerpt,
  normalizeBlueskyText,
  validateBlueskyGraphemes,
} from '@/lib/blog/text-limits';

assert.equal(BLOG_EXCERPT_MAX, 300);
assert.equal(BLOG_BLUESKY_MAX, 300);

assert.equal(normalizeBlogExcerpt('  abc  '), 'abc');
assert.equal(normalizeBlogExcerpt('x'.repeat(400)).length, 300);

const emojiHeavy = '🙂'.repeat(400);
assert.ok(graphemeCount(emojiHeavy) > 300);
const clipped = normalizeBlueskyText('kort', emojiHeavy);
assert.ok(graphemeCount(clipped) <= 300);
assert.ok(clipped.length > 0);

assert.equal(validateBlueskyGraphemes('hei'), null);
assert.ok(validateBlueskyGraphemes(emojiHeavy));

console.log('lib/blog/text-limits.test.ts ok');
