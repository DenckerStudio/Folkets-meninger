import assert from 'node:assert/strict';
import {
  EMBED_HTTP_TIMEOUT_MESSAGE,
  fetchJsonWithTimeout,
  fetchWithTimeout,
} from './fetch-with-timeout';

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

function hangBodyAfterHeaders(): typeof fetch {
  return (_url, init) => {
    const res = new Response('{}', { status: 200 });
    res.json = () =>
      new Promise((_resolve, reject) => {
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
    return Promise.resolve(res);
  };
}

async function testFetchTimeoutAborts(): Promise<void> {
  const fetchImpl = hangUntilAbortFetch();
  let message = '';
  try {
    await fetchWithTimeout(
      'http://ollama-host.example.invalid:11435/api/embed',
      { method: 'POST', body: '{}' },
      { timeoutMs: 25, fetchImpl },
    );
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  assert.equal(message, EMBED_HTTP_TIMEOUT_MESSAGE);
}

async function testJsonBodyReadTimeout(): Promise<void> {
  const fetchImpl = hangBodyAfterHeaders();
  let message = '';
  try {
    await fetchJsonWithTimeout(
      'http://ollama-host.example.invalid:11435/api/embed',
      { method: 'POST', body: '{}' },
      { timeoutMs: 25, fetchImpl },
    );
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  assert.equal(message, EMBED_HTTP_TIMEOUT_MESSAGE);
}

async function main(): Promise<void> {
  await testFetchTimeoutAborts();
  await testJsonBodyReadTimeout();
  console.log('lib/backfill-embedding-v2/fetch-with-timeout.test.ts: ok');
}

void main();
