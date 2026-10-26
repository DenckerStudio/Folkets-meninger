import assert from 'node:assert/strict';
import { buildSearxngSearchUrl, searchSearxng } from './searxng';

const EXAMPLE_SEARXNG_BASE = 'http://192.168.50.154:8002';

const savedSearxngBaseUrl = process.env.SEARXNG_BASE_URL;
process.env.SEARXNG_BASE_URL = EXAMPLE_SEARXNG_BASE;

const url = new URL(buildSearxngSearchUrl('statsbudsjettet 2026'));
assert.equal(url.origin + url.pathname, `${EXAMPLE_SEARXNG_BASE}/search`);
assert.equal(url.searchParams.get('q'), 'statsbudsjettet 2026');
assert.equal(url.searchParams.get('format'), 'json');
assert.equal(url.searchParams.get('language'), 'nb-NO');

const custom = new URL(
  buildSearxngSearchUrl('klima', 'https://searxng.example.test/'),
);
assert.equal(custom.origin, 'https://searxng.example.test');

async function testMissingSearxngBaseUrl() {
  delete process.env.SEARXNG_BASE_URL;
  const result = await searchSearxng('statsbudsjettet');
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected failure');
  assert.equal(
    result.error,
    'Kunne ikke nå SearXNG akkurat nå. Kilder er midlertidig utilgjengelige.',
  );
}

void testMissingSearxngBaseUrl().then(() => {
  if (savedSearxngBaseUrl === undefined) {
    delete process.env.SEARXNG_BASE_URL;
  } else {
    process.env.SEARXNG_BASE_URL = savedSearxngBaseUrl;
  }
  console.log('chat/searxng.test.ts: ok');
});
