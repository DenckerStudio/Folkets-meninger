import assert from 'node:assert/strict';
import { Users } from './Users';

const auth = Users.auth;
assert.ok(auth && typeof auth === 'object');
assert.equal(auth.maxLoginAttempts, 5);
assert.equal(auth.lockTime, 900_000);
assert.equal(auth.tokenExpiration, 7200);
assert.equal(auth.useAPIKey, true);
assert.equal(auth.cookies?.sameSite, 'Lax');

console.log('cms/src/collections/users.auth.test.ts ok');
