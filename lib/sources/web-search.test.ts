import assert from 'node:assert/strict';
import {
  buildWebSearchRequestUrl,
  resetWebSearchLogForTests,
  searchWebSources,
} from './web-search';

const url = buildWebSearchRequestUrl('klima', 'https://searx.internal.test/');
assert.match(url, /format=json/);
assert.match(url, /q=klima/);

resetWebSearchLogForTests();

async function run() {
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const target = String(input);
    assert.match(target, /format=json/);
    return new Response(
      JSON.stringify({
        results: [
          {
            title: 'NRK artikkel',
            url: 'https://www.nrk.no/test/1',
            content: 'Kort sitat',
          },
          {
            title: 'Blocked',
            url: 'https://www.reddit.com/r/norge/comments/x',
            content: 'nope',
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  const ok = await searchWebSources('klima', {
    baseUrl: 'https://searx.internal.test/',
    fetchImpl,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.results.length, 1);
    assert.equal(ok.results[0]?.domain, 'nrk.no');
  }

  const disabled = await searchWebSources('klima', { baseUrl: '' });
  assert.equal(disabled.ok, false);
  assert.equal(disabled.disabled, true);
}

void run().then(() => {
  console.log('lib/sources/web-search.test.ts: ok');
});