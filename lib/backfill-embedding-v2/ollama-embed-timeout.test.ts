import assert from 'node:assert/strict';
import { EMBED_HTTP_TIMEOUT_MESSAGE } from './fetch-with-timeout';
import { fetchOllamaEmbedVectors } from './ollama-embed';

function hangUntilAbortFetch(): typeof fetch {
  return (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal?.addEventListener(
        'abort',
        () => {
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    });
}

async function main(): Promise<void> {
  let message = '';
  try {
    await fetchOllamaEmbedVectors('http://ollama-host.example.invalid:11435', ['test'], {
      fetchImpl: hangUntilAbortFetch(),
      httpTimeoutMs: 20,
    });
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  assert.equal(message, EMBED_HTTP_TIMEOUT_MESSAGE);
  console.log('lib/backfill-embedding-v2/ollama-embed-timeout.test.ts: ok');
}

void main();
