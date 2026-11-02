import assert from 'node:assert/strict';
import { DEFAULT_SITE_URL } from '@/lib/seo/metadata';

async function main(): Promise<void> {
  const prevSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;
  const prevSite = process.env.NEXT_PUBLIC_SITE_URL;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const href =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (href.includes('/rest/v1/share_links')) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(input as RequestInfo | URL, init);
  };

  async function assertShareRedirect(
    response: Response,
    expectedSearch: string,
  ): Promise<void> {
    assert.ok(response.status >= 300 && response.status < 400, `expected redirect, got ${response.status}`);
    const location = response.headers.get('Location');
    assert.ok(location, 'missing Location header');
    assert.doesNotMatch(location, /localhost/i);
    const url = new URL(location!);
    assert.equal(url.origin, DEFAULT_SITE_URL);
    assert.equal(url.search, expectedSearch);
  }

  try {
    const { GET: getShareLink } = await import('./route');

    const badCodeResponse = await getShareLink(
      new Request('http://localhost:3000/l/bad!code'),
      { params: Promise.resolve({ code: 'bad!code' }) },
    );
    await assertShareRedirect(badCodeResponse, '?lenke=utlopt');

    const unknownCodeResponse = await getShareLink(
      new Request('http://localhost:3000/l/unknowncode999'),
      { params: Promise.resolve({ code: 'unknowncode999' }) },
    );
    await assertShareRedirect(unknownCodeResponse, '?lenke=utlopt');
  } finally {
    globalThis.fetch = originalFetch;
    if (prevSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevSupabaseUrl;
    if (prevServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevServiceKey;
    if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevApp;
    if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
  }
}

main()
  .then(() => {
    console.log('app/l/[code]/route.redirect.test.ts ok');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
