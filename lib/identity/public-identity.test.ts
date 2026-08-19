import assert from 'node:assert/strict';
import {
  userHasPublicIdentity,
  resolveHearingCommentAuthor,
} from './public-identity';
import { parseActivityVisibility } from './activity-visibility';

assert.equal(userHasPublicIdentity({ first_name: 'Ab', last_name: 'Cd' }), true);
assert.equal(userHasPublicIdentity({ first_name: 'A', last_name: 'Cd' }), false);
assert.equal(userHasPublicIdentity(null), false);

const author = resolveHearingCommentAuthor({ first_name: 'Ada', last_name: 'Lovelace' });
assert.equal(author?.name, 'Ada Lovelace');
assert.equal(author?.kind, 'user');

assert.equal(parseActivityVisibility('full'), 'full');
assert.equal(parseActivityVisibility('nope'), 'private');

console.log('public-identity tests passed');
