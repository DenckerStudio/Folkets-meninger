import assert from 'node:assert/strict';
import { loginWithNext, sanitizePostLoginPath, toRelativeNext } from './safe-redirect';
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
  sanitizePostLoginPath('/del/abc-123?valg=ja&ref=fb'),
  '/del/abc-123?valg=ja&ref=fb',
);
assert.equal(sanitizePostLoginPath('/del/abc-123'), '/del/abc-123');
assert.equal(sanitizePostLoginPath('/del'), '/del');
assert.equal(sanitizePostLoginPath('/delivery'), routes.utforsk);
assert.equal(sanitizePostLoginPath('/embed/abc-123'), routes.utforsk);

// `toRelativeNext` keeps the post-login hop same-origin even when an absolute
// share URL is round-tripped through `?next=`.
assert.equal(
  toRelativeNext('https://www.folkets-meninger.no/del/abc-123?valg=ja&ref=fb'),
  '/del/abc-123?valg=ja&ref=fb',
);
assert.equal(
  toRelativeNext('https://www.folkets-meninger.no/dashboard/sak/200417#diskusjon'),
  '/dashboard/sak/200417#diskusjon',
);
assert.equal(toRelativeNext('https://evil.example/phish'), routes.utforsk);
assert.equal(toRelativeNext('https://evil.example/del/abc-123'), '/del/abc-123');
assert.equal(toRelativeNext('//evil.example'), routes.utforsk);
assert.equal(toRelativeNext(null), routes.utforsk);

assert.equal(
  loginWithNext('https://www.folkets-meninger.no/del/abc-123?valg=ja&ref=fb'),
  `${routes.login}?next=${encodeURIComponent('/del/abc-123?valg=ja&ref=fb')}`,
);
assert.ok(
  !loginWithNext('https://www.folkets-meninger.no/del/abc-123?valg=ja').includes('https%3A'),
);

assert.equal(
  loginWithNext('/dashboard/sak/200417'),
  `${routes.login}?next=${encodeURIComponent('/dashboard/sak/200417')}`,
);
assert.equal(
  loginWithNext('/del/abc-123?valg=ja&ref=fb'),
  `${routes.login}?next=${encodeURIComponent('/del/abc-123?valg=ja&ref=fb')}`,
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
