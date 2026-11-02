import assert from 'node:assert/strict';
import { AUTH_CALLBACK_LOGIN_FAILED_PATH } from '@/lib/auth/oauth-callback-redirect';
import { DEFAULT_SITE_URL } from '@/lib/seo/metadata';

async function main(): Promise<void> {
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;
  const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;

  try {
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost:3000/api/auth/callback'));
    assert.ok(response.status >= 300 && response.status < 400, `expected redirect, got ${response.status}`);
    const location = response.headers.get('Location');
    assert.ok(location, 'missing Location header');
    assert.doesNotMatch(location, /localhost/i);

    const url = new URL(location!);
    assert.equal(url.origin, DEFAULT_SITE_URL);
    assert.equal(url.pathname + url.search, AUTH_CALLBACK_LOGIN_FAILED_PATH);
  } finally {
    if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevApp;
    if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
  }
}

main()
  .then(() => {
    console.log('app/api/auth/callback/route.redirect.test.ts ok');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
