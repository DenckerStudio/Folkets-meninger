import assert from 'node:assert/strict';
import { loginWithNext, sanitizePostLoginPath } from './safe-redirect';
import { routes } from './routes';

assert.equal(sanitizePostLoginPath(null), routes.utforsk);
assert.equal(sanitizePostLoginPath('https://evil.example'), routes.utforsk);
assert.equal(sanitizePostLoginPath('//evil.example'), routes.utforsk);
assert.equal(sanitizePostLoginPath('/\\evil.example'), routes.utforsk);
assert.equal(sanitizePostLoginPath('/dashboard/horinger'), routes.horinger);
assert.equal(
  sanitizePostLoginPath('/dashboard/utforsk?chat=1&sak=200417'),
  '/dashboard/utforsk?chat=1&sak=200417',
);
assert.equal(
  sanitizePostLoginPath('/dashboard/sak/123#diskusjon'),
  '/dashboard/sak/123#diskusjon',
);

assert.equal(
  loginWithNext('/dashboard/sak/200417'),
  `${routes.login}?next=${encodeURIComponent('/dashboard/sak/200417')}`,
);
assert.equal(
  loginWithNext('/dashboard/utforsk?chat=1&sak=200417'),
  `${routes.login}?next=${encodeURIComponent('/dashboard/utforsk?chat=1&sak=200417')}`,
);
assert.equal(
  loginWithNext('https://evil.example'),
  `${routes.login}?next=${encodeURIComponent(routes.utforsk)}`,
);
assert.equal(
  loginWithNext('//evil.example'),
  `${routes.login}?next=${encodeURIComponent(routes.utforsk)}`,
);
assert.equal(
  loginWithNext(routes.login),
  `${routes.login}?next=${encodeURIComponent(routes.utforsk)}`,
);
assert.equal(
  loginWithNext(`${routes.login}?next=https://evil.example`),
  `${routes.login}?next=${encodeURIComponent(routes.utforsk)}`,
);

console.log('safe-redirect.test.ts: ok');
