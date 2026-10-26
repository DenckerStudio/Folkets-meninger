import assert from 'node:assert/strict';
import {
  DEFAULT_EMBED_QUERY_MODEL,
  embedQueryApiUrl,
  fetchCentralQueryEmbedding,
  readBgeQueryVector,
  resetCentralEmbedFailureLogForTests,
} from './query-embed';
import { VECTOR_V2_DIMENSIONS } from './vector-search';

async function main() {
  const vector = Array.from({ length: VECTOR_V2_DIMENSIONS }, (_, i) => i / VECTOR_V2_DIMENSIONS);

  assert.equal(embedQueryApiUrl('http://192.168.50.154:11435'), 'http://192.168.50.154:11435/api/embed');
  assert.equal(
    embedQueryApiUrl('http://192.168.50.154:11435/'),
    'http://192.168.50.154:11435/api/embed',
  );
  assert.equal(embedQueryApiUrl('not-a-url'), null);

  assert.deepEqual(readBgeQueryVector({ embeddings: [vector] }), vector);
  assert.deepEqual(readBgeQueryVector({ embedding: vector }), vector);
  assert.equal(readBgeQueryVector({ embeddings: [[1, 2, 3]] }), null);
  assert.equal(readBgeQueryVector(null), null);

  resetCentralEmbedFailureLogForTests();
  assert.equal(await fetchCentralQueryEmbedding('test', { embedBaseUrl: '' }), null);

  const embedWarnings: string[] = [];
  const prevWarn = console.warn;
  console.warn = (msg: string) => {
    embedWarnings.push(msg);
  };
  const prevEmbedUrl = process.env.EMBED_QUERY_URL;
  delete process.env.EMBED_QUERY_URL;
  resetCentralEmbedFailureLogForTests();
  assert.equal(await fetchCentralQueryEmbedding('test'), null);
  assert.equal(embedWarnings.filter((w) => w.includes('[embed]')).length, 1);
  assert.match(embedWarnings[0], /EMBED_QUERY_URL mangler/);
  await fetchCentralQueryEmbedding('test');
  assert.equal(embedWarnings.filter((w) => w.includes('[embed]')).length, 1);
  if (prevEmbedUrl === undefined) delete process.env.EMBED_QUERY_URL;
  else process.env.EMBED_QUERY_URL = prevEmbedUrl;
  console.warn = prevWarn;

  let captured: { url: string; body: Record<string, unknown> } | null = null;
  const okFetch = (async (url: string, init: { body?: string }) => {
    captured = { url, body: JSON.parse(String(init.body)) };
    return { ok: true, json: async () => ({ embeddings: [vector] }) };
  }) as unknown as typeof fetch;

  resetCentralEmbedFailureLogForTests();
  const result = await fetchCentralQueryEmbedding('barnehage i Oslo', {
    embedBaseUrl: 'http://embed.local:11435',
    model: 'bge-m3',
    fetchImpl: okFetch,
    timeoutMs: 800,
  });
  assert.ok(result);
  assert.equal(result!.length, VECTOR_V2_DIMENSIONS);
  assert.equal(captured!.url, 'http://embed.local:11435/api/embed');
  assert.equal(captured!.body.model, 'bge-m3');
  assert.equal(captured!.body.input, 'barnehage i Oslo');

  const failFetch = (async () => ({ ok: false, status: 503 })) as unknown as typeof fetch;
  resetCentralEmbedFailureLogForTests();
  assert.equal(
    await fetchCentralQueryEmbedding('x', {
      embedBaseUrl: 'http://embed.local:11435',
      fetchImpl: failFetch,
    }),
    null,
  );

  const throwFetch = (async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  resetCentralEmbedFailureLogForTests();
  assert.equal(
    await fetchCentralQueryEmbedding('x', {
      embedBaseUrl: 'http://embed.local:11435',
      fetchImpl: throwFetch,
    }),
    null,
  );

  assert.equal(DEFAULT_EMBED_QUERY_MODEL, 'bge-m3');

  console.log('chat/query-embed.test.ts: ok');
}

void main();
