import assert from 'node:assert/strict';
import { loginIdentifierFromBody } from './loginBody';

assert.equal(loginIdentifierFromBody({ email: ' Red@Example.com ' }), 'red@example.com');
assert.equal(loginIdentifierFromBody({ username: 'Agent' }), 'agent');

console.log('cms/src/lib/loginBody.test.ts ok');
