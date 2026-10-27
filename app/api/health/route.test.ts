import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GET, HEAD } from './route';

async function run() {
  const getRes = await GET();
  assert.equal(getRes.status, 200);
  assert.equal(getRes.headers.get('cache-control'), 'no-store');
  const body = await getRes.json();
  assert.deepEqual(body, { ok: true });

  const headRes = await HEAD();
  assert.equal(headRes.status, 200);
  assert.equal(headRes.headers.get('cache-control'), 'no-store');
  assert.equal(await headRes.text(), '');

  const middlewareSrc = readFileSync(new URL('../../../middleware.ts', import.meta.url), 'utf8');
  const matcherBlock = middlewareSrc.match(/matcher:\s*\[([\s\S]*?)\],/)?.[1] ?? '';
  assert.doesNotMatch(matcherBlock, /health/, 'middleware matcher must not cover /api/health');

  console.log('app/api/health/route.test.ts: ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
