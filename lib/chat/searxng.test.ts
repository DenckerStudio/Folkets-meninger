import assert from 'node:assert/strict';
import { buildSearxngSearchUrl, DEFAULT_SEARXNG_BASE_URL } from './searxng';

const url = new URL(buildSearxngSearchUrl('statsbudsjettet 2026'));
assert.equal(url.origin + url.pathname, `${DEFAULT_SEARXNG_BASE_URL}/search`);
assert.equal(url.searchParams.get('q'), 'statsbudsjettet 2026');
assert.equal(url.searchParams.get('format'), 'json');
assert.equal(url.searchParams.get('language'), 'nb-NO');

const custom = new URL(
  buildSearxngSearchUrl('klima', 'https://searxng.example.test/'),
);
assert.equal(custom.origin, 'https://searxng.example.test');

console.log('chat/searxng.test.ts: ok');
