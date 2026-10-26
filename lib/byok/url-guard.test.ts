import assert from 'node:assert/strict';
import { createByokPinnedFetch } from './pinned-fetch.server';
import {
  BYOK_BASE_URL_REJECTED_NB,
  BYOK_OLLAMA_PROBE_ERROR_NB,
  BYOK_OLLAMA_PROBE_HTTP_STATUS,
  assertIpAllowedSync,
  assertSafeOutboundUrl,
  normalizeHostnameForCheck,
  privateAllowlistPermitsUrl,
  readPrivateUrlAllowlistFromEnv,
  resolveAllowPrivateForUrl,
} from './url-guard';

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
  assert.equal(normalizeHostnameForCheck('LOCALHOST.'), 'localhost');
  assert.equal(normalizeHostnameForCheck('host.example.com.'), 'host.example.com');

  await accepts('https://ollama.example.com/v1');
  await rejects('ftp://ollama.example.com/v1');
  await rejects('https://user:pass@ollama.example.com/v1');
  await rejects('https://ollama.example.com:8080/v1');
  await rejects('http://localhost:11434/v1');
  await rejects('http://localhost.:11434/v1');
  await rejects('http://evil.localhost:11434/v1');
  await rejects('http://127.0.0.1:11434/v1');
  await rejects('http://10.0.0.1:11434/v1');
  await rejects('http://192.168.1.1:11434/v1');
  await rejects('http://169.254.169.254:11434/v1');
  await rejects('http://100.64.0.1:11434/v1');
  await rejects('http://192.0.0.1:11434/v1');
  await rejects('http://192.0.2.1:11434/v1');
  await rejects('http://198.18.0.1:11434/v1');
  await rejects('http://198.51.100.1:11434/v1');
  await rejects('http://203.0.113.1:11434/v1');
  await rejects('http://240.0.0.1:11434/v1');
  await rejects('http://255.255.255.255:11434/v1');
  await rejects('http://[::1]:11434/v1');
  await rejects('http://[::127.0.0.1]:11434/v1');
  await rejects('http://[64:ff9b::a9fe:a9fe]:11434/v1');
  await rejects('http://[64:ff9b:1::1]:11434/v1');
  await rejects('http://[2002:c000:0201::1]:11434/v1');
  await rejects('http://[2001:0000:413c:9a7b:13f9:fe6a:dcbc:6a21]:11434/v1');
  await rejects('http://[100::1]:11434/v1');
  await rejects('http://[fc00::1]:11434/v1');
  await rejects('http://ollama.local:11434/v1');
  await rejects('http://docker-service:11434/v1');

  assert.throws(() => assertIpAllowedSync('fd00:ec2::254', true));
  assert.throws(() => assertIpAllowedSync('fd00:ec2::254', false));

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
  assert.equal(resolveAllowPrivateForUrl('http://192.168.50.154:11434/v1', {
    isAdmin: true,
    allowlistOrigins: allowlist,
  }), true);
  assert.deepEqual(readPrivateUrlAllowlistFromEnv(''), []);

  let lookupCalls = 0;
  const rebindingLookup = async () => {
    lookupCalls += 1;
    if (lookupCalls === 1) {
      return [{ address: '93.184.216.34', family: 4 }];
    }
    return [{ address: '127.0.0.1', family: 4 }];
  };
  const access = { isAdmin: false, lookup: rebindingLookup };
  const pinned = createByokPinnedFetch(access, 'https://rebind.example/v1');
  await assert.rejects(async () => {
    await pinned('https://rebind.example/api/tags');
  });

  assert.equal(BYOK_OLLAMA_PROBE_HTTP_STATUS, 400);
  assert.match(BYOK_OLLAMA_PROBE_ERROR_NB, /Kunne ikke hente modellene/);
  assert.match(BYOK_BASE_URL_REJECTED_NB, /offentlig/);

  console.log('byok/url-guard.test.ts: ok');
}

void main();
