import assert from 'node:assert/strict';
import { DEFAULT_POST_LOGIN_PATH, sanitizePostLoginPath } from './safe-redirect';

assert.equal(DEFAULT_POST_LOGIN_PATH, '/dashboard/utforsk');
assert.equal(sanitizePostLoginPath(null), '/dashboard/utforsk');
assert.equal(sanitizePostLoginPath(undefined), '/dashboard/utforsk');
assert.equal(sanitizePostLoginPath(''), '/dashboard/utforsk');
assert.equal(sanitizePostLoginPath('/dashboard/forum'), '/dashboard/forum');
assert.equal(sanitizePostLoginPath('/dashboard/sak/123'), '/dashboard/sak/123');
assert.equal(sanitizePostLoginPath('https://evil.example'), '/dashboard/utforsk');
assert.equal(sanitizePostLoginPath('//evil.example'), '/dashboard/utforsk');

console.log('safe-redirect.test.ts: ok');
