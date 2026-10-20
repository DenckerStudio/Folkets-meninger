import assert from 'node:assert/strict';
import { loginIdentifierFromBody, loginRateLimitKey } from './loginBody';

assert.equal(loginIdentifierFromBody({ email: ' Red@Example.com ' }), 'red@example.com');
assert.equal(loginIdentifierFromBody({ username: 'Agent' }), 'agent');
assert.equal(loginRateLimitKey('203.0.113.1', 'a@b.no'), '203.0.113.1|a@b.no');
assert.equal(loginRateLimitKey('unknown', ''), 'unknown|_');

console.log('cms/src/lib/loginBody.test.ts ok');
