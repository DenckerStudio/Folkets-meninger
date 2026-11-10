import assert from 'node:assert/strict';
import {
  buildEmbedApiUrl,
  checkEmbedUrlsAtStartup,
  isChatQueryEmbedUrl,
} from './backfill-embedding-v2/urls';
import {
  LMSTUDIO_DEPRECATED_MESSAGE,
  parseBackfillProvider,
  requireBackfillUrl,
} from './backfill-embedding-v2/provider';
import { validateEmbeddingVector } from './backfill-embedding-v2/embed-batch';
import { fetchOllamaEmbedVectors } from './backfill-embedding-v2/ollama-embed';

function vec(dim: number): number[] {
  return Array.from({ length: dim }, (_, i) => i / Math.max(dim, 1));
}

async function main(): Promise<void> {
  assert.equal(parseBackfillProvider(undefined), 'ollama');
  assert.equal(parseBackfillProvider('ollama'), 'ollama');
  assert.throws(() => parseBackfillProvider('lmstudio'), (err: Error) => {
    return err.message === LMSTUDIO_DEPRECATED_MESSAGE;
  });

  assert.equal(
    buildEmbedApiUrl('http://ollama-host.example.invalid:11435'),
    'http://ollama-host.example.invalid:11435/api/embed',
  );
  assert.equal(
    buildEmbedApiUrl('http://ollama-host.example.invalid:11435/api/embed'),
    'http://ollama-host.example.invalid:11435/api/embed',
  );

  assert.equal(isChatQueryEmbedUrl('http://h:11435', 'http://other:11435'), true);
  const chat = checkEmbedUrlsAtStartup('http://h:11435', 'http://h:11435', undefined);
  assert.equal(chat.busyPauseDefault, true);

  const legacy = checkEmbedUrlsAtStartup('http://legacy-gpu:11434', '', undefined);
  assert.equal(legacy.chatInstance, false);
  assert.equal(legacy.busyPauseDefault, false);

  const good = vec(1024);
  assert.ok(validateEmbeddingVector({ embedding: good }));
  assert.equal(validateEmbeddingVector({ embedding: vec(768) }), null);

  const vectors1024 = [vec(1024)];
  const fetchImpl = async () =>
    new Response(JSON.stringify({ embeddings: vectors1024 }), { status: 200 });

  const res = await fetchOllamaEmbedVectors('http://ollama-host.example.invalid:11435', ['x'], {
    fetchImpl,
  });
  assert.equal(res.vectors[0].length, 1024);

  let dimMsg = '';
  const badFetch = async () =>
    new Response(JSON.stringify({ embeddings: [vec(768)] }), { status: 200 });
  try {
    await fetchOllamaEmbedVectors('http://ollama-host.example.invalid:11435', ['x'], {
      fetchImpl: badFetch,
    });
  } catch (err) {
    dimMsg = err instanceof Error ? err.message : String(err);
  }
  assert.match(dimMsg, /1024/);
  assert.match(dimMsg, /768/);

  assert.throws(() => requireBackfillUrl('ollama', ''));

  console.log('backfill-embedding-v2-ollama.test.ts: ok');
}

void main();
