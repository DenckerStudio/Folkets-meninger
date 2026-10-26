import assert from 'node:assert/strict';
import {
  BYOK_BASE_URL_REJECTED_NB,
  BYOK_OLLAMA_UNREACHABLE_NB,
  assertSafeOutboundUrl,
  createSsrfGuardedFetch,
  normalizeAllowlistOrigin,
  privateAllowlistPermitsUrl,
  readPrivateUrlAllowlistFromEnv,
  resolveAllowPrivateForUrl,
} from './url-guard';
import { fetchOllamaChatModels } from './ollama';

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];

async function rejects(url: string, options: { allowPrivate?: boolean } = {}) {
  await assert.rejects(
    () =>
      assertSafeOutboundUrl(url, {
        allowPrivate: options.allowPrivate ?? false,
        lookup: publicLookup,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      return true;
    },
  );
}

async function accepts(url: string, options: { allowPrivate?: boolean } = {}) {
  await assertSafeOutboundUrl(url, {
    allowPrivate: options.allowPrivate ?? false,
    lookup: publicLookup,
  });
}

async function main() {
  await accepts('https://ollama.example.com/v1');
  await accepts('http://ollama.example.com:11434/v1');
  await rejects('ftp://ollama.example.com/v1');
  await rejects('https://user:pass@ollama.example.com/v1');
  await rejects('https://ollama.example.com:8080/v1');
  await rejects('http://localhost:11434/v1');
  await rejects('http://127.0.0.1:11434/v1');
  await rejects('http://127.1.1.1:11434/v1');
  await rejects('http://0.0.0.0:11434/v1');
  await rejects('http://0177.0.0.1:11434/v1');
  await rejects('http://2130706433:11434/v1');
  await rejects('http://0x7f000001:11434/v1');
  await rejects('http://10.0.0.1:11434/v1');
  await rejects('http://172.16.0.1:11434/v1');
  await rejects('http://192.168.1.1:11434/v1');
  await rejects('http://169.254.1.1:11434/v1');
  await rejects('http://169.254.169.254:11434/v1');
  await rejects('http://100.64.0.1:11434/v1');
  await rejects('http://224.0.0.1:11434/v1');
  await rejects('http://240.0.0.1:11434/v1');
  await rejects('http://[::1]:11434/v1');
  await rejects('http://[fc00::1]:11434/v1');
  await rejects('http://[fe80::1]:11434/v1');
  await rejects('http://ollama.local:11434/v1');
  await rejects('http://metadata.google.internal:11434/v1');
  await rejects('http://docker-service:11434/v1');

  await accepts('http://192.168.50.154:11434/v1', { allowPrivate: true });
  await rejects('http://192.168.50.154:11434/v1', { allowPrivate: false });

  const allowlist = ['http://192.168.50.154:11434'];
  assert.equal(
    privateAllowlistPermitsUrl('http://192.168.50.154:11434/v1', {
      isAdmin: true,
      allowlistOrigins: allowlist,
    }),
    true,
  );
  assert.equal(
    privateAllowlistPermitsUrl('http://192.168.50.154:11434/v1', {
      isAdmin: false,
      allowlistOrigins: allowlist,
    }),
    false,
  );
  assert.equal(
    privateAllowlistPermitsUrl('http://192.168.1.5:11434/v1', {
      isAdmin: true,
      allowlistOrigins: allowlist,
    }),
    false,
  );
  assert.equal(resolveAllowPrivateForUrl('http://192.168.50.154:11434/v1', {
    isAdmin: true,
    allowlistOrigins: allowlist,
  }), true);
  assert.deepEqual(readPrivateUrlAllowlistFromEnv(''), []);
  assert.deepEqual(readPrivateUrlAllowlistFromEnv(undefined), []);
  assert.deepEqual(
    readPrivateUrlAllowlistFromEnv('http://192.168.50.154:11434, https://bad:9999/x'),
    ['http://192.168.50.154:11434'],
  );
  assert.equal(normalizeAllowlistOrigin('http://192.168.50.154:11434/'), 'http://192.168.50.154:11434');

  const redirectResult = await fetchOllamaChatModels('https://ollama.example.com/v1', {
    fetchImpl: (async () =>
      new Response('', { status: 302, headers: { location: 'http://127.0.0.1/' } })) as typeof fetch,
  });
  assert.equal(redirectResult.ok, false);
  if (!redirectResult.ok) {
    assert.equal(redirectResult.error, BYOK_OLLAMA_UNREACHABLE_NB);
    assert.doesNotMatch(redirectResult.error, /127\.0\.0\.1/);
    assert.doesNotMatch(redirectResult.error, /302/);
  }

  const guarded = createSsrfGuardedFetch(
    (url) => assertSafeOutboundUrl(url, { allowPrivate: false, lookup: publicLookup }),
    (async () => new Response('ok', { status: 200 })) as typeof fetch,
  );
  const okResponse = await guarded('https://ollama.example.com/v1/chat/completions');
  assert.equal(okResponse.status, 200);

  await assert.rejects(() =>
    guarded('http://127.0.0.1:11434/v1/chat/completions'),
  );

  assert.equal(BYOK_BASE_URL_REJECTED_NB.includes('http'), false);

  console.log('byok/url-guard.test.ts: ok');
}

void main();
