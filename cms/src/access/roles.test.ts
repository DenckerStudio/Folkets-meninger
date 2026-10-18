import assert from 'node:assert/strict';
import type { PayloadRequest } from 'payload';
import {
  accessAllows,
  mediaDeleteAccess,
  postsCreateAccess,
  postsDeleteAccess,
  postsReadAccess,
  postsUpdateAccess,
  taxonomyWriteAccess,
  usersReadAccess,
} from './roles';

function req(role: string, id = 1): PayloadRequest {
  return {
    user: { id, role, email: `${role}@example.com` },
  } as unknown as PayloadRequest;
}

assert.equal(accessAllows(postsCreateAccess, req('reader')), false);
assert.equal(accessAllows(postsCreateAccess, req('agent')), true);
assert.equal(accessAllows(postsCreateAccess, req('redaktor')), true);

assert.equal(accessAllows(postsUpdateAccess, req('reader')), false);
assert.deepEqual(accessAllows(postsUpdateAccess, req('agent')), { _status: { equals: 'draft' } });
assert.equal(accessAllows(postsUpdateAccess, req('admin')), true);

assert.equal(accessAllows(postsDeleteAccess, req('reader')), false);
assert.equal(accessAllows(postsDeleteAccess, req('agent')), false);
assert.equal(accessAllows(postsDeleteAccess, req('redaktor')), true);

assert.deepEqual(accessAllows(postsReadAccess, req('reader')), { _status: { equals: 'published' } });
assert.equal(accessAllows(postsReadAccess, req('admin')), true);

assert.equal(accessAllows(mediaDeleteAccess, req('reader')), false);
assert.equal(accessAllows(mediaDeleteAccess, req('redaktor')), true);

assert.equal(accessAllows(taxonomyWriteAccess, req('reader')), false);
assert.equal(accessAllows(taxonomyWriteAccess, req('admin')), true);

assert.equal(accessAllows(usersReadAccess, req('admin')), true);
assert.deepEqual(accessAllows(usersReadAccess, req('reader', 42)), { id: { equals: 42 } });

console.log('cms/src/access/roles.test.ts ok');
