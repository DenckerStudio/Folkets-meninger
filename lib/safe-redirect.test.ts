import assert from 'node:assert/strict';
import { sanitizePostLoginPath } from './safe-redirect';
import { routes } from './routes';

assert.equal(sanitizePostLoginPath(null), routes.utforsk);
assert.equal(sanitizePostLoginPath('https://evil.example'), routes.utforsk);
assert.equal(sanitizePostLoginPath('//evil.example'), routes.utforsk);
assert.equal(sanitizePostLoginPath('/dashboard/horinger'), routes.horinger);

console.log('safe-redirect.test.ts: ok');
