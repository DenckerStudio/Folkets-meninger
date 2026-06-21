import assert from 'node:assert/strict';
import { isForumReelsPublicEnabled } from './reels-visibility';

const original = process.env.FORUM_REELS_PUBLIC;

try {
  delete process.env.FORUM_REELS_PUBLIC;
  assert.equal(isForumReelsPublicEnabled(), false);

  process.env.FORUM_REELS_PUBLIC = 'true';
  assert.equal(isForumReelsPublicEnabled(), true);

  process.env.FORUM_REELS_PUBLIC = '1';
  assert.equal(isForumReelsPublicEnabled(), false);
} finally {
  if (original === undefined) {
    delete process.env.FORUM_REELS_PUBLIC;
  } else {
    process.env.FORUM_REELS_PUBLIC = original;
  }
}

console.log('reels-visibility tests passed');
