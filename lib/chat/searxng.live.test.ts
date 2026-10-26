import assert from 'node:assert/strict';
import { writeLiveTestArtifact } from '@/lib/test/write-live-artifact';
import { exitIfCiSkipsProdLive } from '@/lib/test/skip-in-ci-live';
import { searchSearxng } from './searxng';

exitIfCiSkipsProdLive('chat/searxng.live.test.ts');

async function main() {
  const result = await searchSearxng('Stortinget statsbudsjettet', { timeoutMs: 15000, limit: 4 });
  assert.equal(result.ok, true, result.ok ? '' : result.error);
  if (!result.ok) throw new Error(result.error);
  assert.ok(result.results.length > 0, 'SearXNG returned no hits');
  assert.ok(result.results.every((hit) => hit.title && hit.url.startsWith('http')));

  writeLiveTestArtifact('searxng-live.json', {
    ok: true,
    count: result.results.length,
    titles: result.results.map((hit) => hit.title),
  });

  console.log('chat/searxng.live.test.ts: ok', result.results.length, 'hits');
}

void main();
