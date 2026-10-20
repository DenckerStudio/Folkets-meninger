import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { searchSearxng } from './searxng';

async function main() {
  const result = await searchSearxng('Stortinget statsbudsjettet', { timeoutMs: 15000, limit: 4 });
  assert.equal(result.ok, true, result.ok ? '' : result.error);
  if (!result.ok) throw new Error(result.error);
  assert.ok(result.results.length > 0, 'SearXNG returned no hits');
  assert.ok(result.results.every((hit) => hit.title && hit.url.startsWith('http')));

  const artifactDir =
    process.env.CURSOR_ARTIFACTS_DIR ?? join(process.cwd(), 'artifacts', 'ci-live-tests');
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(
    join(artifactDir, 'searxng-live.json'),
    JSON.stringify(
      { ok: true, count: result.results.length, titles: result.results.map((hit) => hit.title) },
      null,
      2,
    ),
  );

  console.log('chat/searxng.live.test.ts: ok', result.results.length, 'hits');
}

void main();
