import assert from 'node:assert/strict';
import { DEFAULT_SITE_URL } from '@/lib/seo/metadata';
import {
  AUTH_CALLBACK_LOGIN_FAILED_PATH,
  buildAuthCallbackFailureRedirect,
  buildAuthCallbackSuccessRedirect,
  resolveAuthCallbackNext,
} from '@/lib/auth/oauth-callback-redirect';
import { routes } from '@/lib/routes';

const prevApp = process.env.NEXT_PUBLIC_APP_URL;
const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
delete process.env.NEXT_PUBLIC_APP_URL;
delete process.env.NEXT_PUBLIC_SITE_URL;

try {
  assert.equal(resolveAuthCallbackNext('//evil.com'), routes.utforsk);
  assert.equal(resolveAuthCallbackNext('https://evil.com'), routes.utforsk);

  const failure = buildAuthCallbackFailureRedirect();
  assert.equal(failure.origin, DEFAULT_SITE_URL);
  assert.equal(failure.pathname, '/auth/login');
  assert.equal(failure.searchParams.get('error'), 'auth_failed');
  assert.doesNotMatch(failure.href, /localhost/i);
  assert.equal(failure.pathname + failure.search, AUTH_CALLBACK_LOGIN_FAILED_PATH);

  const success = buildAuthCallbackSuccessRedirect('/dashboard/utforsk');
  assert.equal(success.origin, DEFAULT_SITE_URL);
  assert.equal(success.pathname, '/dashboard/utforsk');
  assert.doesNotMatch(success.href, /localhost/i);

  const evilNext = buildAuthCallbackSuccessRedirect(resolveAuthCallbackNext('https://evil.com'));
  assert.equal(evilNext.pathname, routes.utforsk);
} finally {
  if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = prevApp;
  if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
}

console.log('lib/auth/oauth-callback-redirect.test.ts ok');
