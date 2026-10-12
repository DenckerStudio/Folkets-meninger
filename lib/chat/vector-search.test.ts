import assert from 'node:assert/strict';
import {
  VECTOR_DIMENSIONS,
  createOllamaVectorizer,
  ollamaVectorUrl,
  readVector,
  searchChunksByVector,
  type VectorSearchClient,
} from './vector-search';
import { mergeChunks } from './rag';

const vector = (length = VECTOR_DIMENSIONS) => Array.from({ length }, (_, i) => i / length);

function vectorCredential(baseUrl = 'http://localhost:11434/v1') {
  return { provider: 'ollama' as const, baseUrl };
}

async function main() {
  // --- ollamaVectorUrl -----------------------------------------------------
  assert.equal(ollamaVectorUrl('http://localhost:11434/v1'), 'http://localhost:11434/api/embeddings');
  assert.equal(ollamaVectorUrl('http://localhost:11434/'), 'http://localhost:11434/api/embeddings');
  assert.equal(ollamaVectorUrl('https://ollama.example.com/api'), 'https://ollama.example.com/api/embeddings');
  assert.equal(ollamaVectorUrl('not a url'), null);
  assert.equal(ollamaVectorUrl('ftp://localhost'), null);

  // --- readVector ----------------------------------------------------------
  assert.deepEqual(readVector({ embedding: [1, 2, 3] }), [1, 2, 3]);
  assert.deepEqual(readVector({ embeddings: [[0.5, 0.25]] }), [0.5, 0.25]);
  assert.deepEqual(readVector({ embedding: ['1', '2'] }), [1, 2]);
  assert.equal(readVector({ embedding: [] }), null);
  assert.equal(readVector({ embedding: [1, 'x'] }), null);
  assert.equal(readVector(null), null);
  assert.equal(readVector({}), null);

  // --- createOllamaVectorizer ----------------------------------------------
  assert.equal(createOllamaVectorizer(null), null);
  assert.equal(createOllamaVectorizer({ provider: 'openai', baseUrl: null }), null);
  assert.equal(createOllamaVectorizer({ provider: 'ollama', baseUrl: null }), null);
  assert.equal(createOllamaVectorizer({ provider: 'ollama', baseUrl: 'nonsense' }), null);

  const embed = vector();
  let captured: { url: string; body: Record<string, unknown> } | null = null;
  const okFetch = (async (url: string, init: { body?: string }) => {
    captured = { url, body: JSON.parse(String(init.body)) };
    return { ok: true, json: async () => ({ embedding: embed }) };
  }) as unknown as typeof fetch;

  const vectorizer = createOllamaVectorizer(vectorCredential(), { fetchImpl: okFetch });
  assert.ok(vectorizer);
  const result = await vectorizer!('hva koster innvandringsloven');
  assert.equal(result?.length, VECTOR_DIMENSIONS);
  assert.equal(captured!.url, 'http://localhost:11434/api/embeddings');
  assert.equal(captured!.body.model, 'nomic-embed-text');
  assert.equal(captured!.body.prompt, 'hva koster innvandringsloven');

  const wrongDims = createOllamaVectorizer(vectorCredential(), {
    fetchImpl: (async () => ({ ok: true, json: async () => ({ embedding: [1, 2, 3] }) })) as unknown as typeof fetch,
  });
  assert.equal(await wrongDims!('q'), null);

  const notOk = createOllamaVectorizer(vectorCredential(), {
    fetchImpl: (async () => ({ ok: false })) as unknown as typeof fetch,
  });
  assert.equal(await notOk!('q'), null);

  const throws = createOllamaVectorizer(vectorCredential(), {
    fetchImpl: (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch,
  });
  assert.equal(await throws!('q'), null);

  // --- searchChunksByVector ------------------------------------------------
  let rpcArgs: Record<string, unknown> | null = null;
  const rpcClient = {
    rpc: async (_fn: string, args: Record<string, unknown>) => {
      rpcArgs = args;
      return {
        data: [{ document_id: 'd1', chunk_index: 2, content: '  innhold  ', similarity: 0.87 }],
        error: null,
      };
    },
  } as unknown as VectorSearchClient;

  const hits = await searchChunksByVector(rpcClient, '200365', 'query', async () => vector(), 5);
  assert.equal(hits?.length, 1);
  assert.equal(hits![0].documentId, 'd1');
  assert.equal(hits![0].content, 'innhold');
  assert.equal(rpcArgs!.p_issue_id, '200365');
  assert.deepEqual(rpcArgs!.p_query_embedding, vector());
  assert.equal(rpcArgs!.p_match_count, 5);

  const rpcError = {
    rpc: async () => ({ data: null, error: { message: 'permission denied' } }),
  } as unknown as VectorSearchClient;
  assert.equal(await searchChunksByVector(rpcError, '200365', 'q', async () => vector(), 5), null);

  let called = false;
  const noVectorClient = {
    rpc: async () => {
      called = true;
      return { data: [], error: null };
    },
  } as unknown as VectorSearchClient;
  assert.equal(await searchChunksByVector(noVectorClient, '200365', 'q', async () => null, 5), null);
  assert.equal(called, false, 'rpc must not run when the query cannot be vectorized');

  assert.equal(await searchChunksByVector(rpcClient, '   ', 'q', async () => vector(), 5), null);

  // --- mergeChunks ---------------------------------------------------------
  const a = { documentId: 'd1', chunkIndex: 0, content: 'a', rank: 1 };
  const dup = { documentId: 'd1', chunkIndex: 0, content: 'dup', rank: 2 };
  const c = { documentId: 'd2', chunkIndex: 1, content: 'c', rank: 3 };
  const merged = mergeChunks([a], [dup, c], 5);
  assert.equal(merged.length, 2);
  assert.equal(merged[0], a);
  assert.equal(merged[1], c);
  assert.equal(mergeChunks([a, dup, c], [], 2).length, 2);

  console.log('chat/vector-search.test.ts: ok');
}

void main();
