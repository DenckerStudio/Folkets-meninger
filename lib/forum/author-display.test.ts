import assert from 'node:assert/strict';
import { resolveForumAuthor, userHasForumIdentity } from '@/lib/forum/author-display';
import { FORUM_SYSTEM_AUTHOR_NAME } from '@/lib/forum/admin';

function testSystemThread() {
  const author = resolveForumAuthor({ isSystemThread: true });
  assert.equal(author?.name, FORUM_SYSTEM_AUTHOR_NAME);
  assert.equal(author?.kind, 'platform');
}

function testUserWithNames() {
  const author = resolveForumAuthor({
    users: { first_name: 'Ola', last_name: 'Nordmann' },
  });
  assert.equal(author?.name, 'Ola Nordmann');
  assert.equal(author?.kind, 'user');
}

function testNoAnonymousFallback() {
  const author = resolveForumAuthor({ users: null });
  assert.equal(author, null);
}

function testIdentityValidation() {
  assert.equal(userHasForumIdentity({ first_name: 'Ab', last_name: 'Cd' }), true);
  assert.equal(userHasForumIdentity({ first_name: 'A', last_name: 'Cd' }), false);
}

testSystemThread();
testUserWithNames();
testNoAnonymousFallback();
testIdentityValidation();

console.log('author-display tests passed');
