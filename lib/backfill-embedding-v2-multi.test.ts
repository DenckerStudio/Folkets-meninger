import assert from 'node:assert/strict';
import { selectClaimLane } from './backfill-embedding-v2/lane-routing';
import { EndpointHealth } from './backfill-embedding-v2/endpoint-health';
import {
  finalizeEndpoints,
  parseEndpointJson,
  resolveEndpointConfig,
} from './backfill-embedding-v2/endpoints';
import {
  maskSecret,
  redactKnownSecrets,
  resolveApiKeyFromEnvVarName,
  safeErrorMessage,
} from './backfill-embedding-v2/secrets';
import { PREFLIGHT_TEXT_COUNT } from './backfill-embedding-v2/preflight-texts';
import { cosineSimilarity } from './backfill-embedding-v2/cosine';
import { DEFAULT_LMSTUDIO_MODEL_TAG } from './backfill-embedding-v2/provider';
import type { ResolvedEndpoint } from './backfill-embedding-v2/endpoints';

function primaryEndpoint(overrides: Partial<ResolvedEndpoint> = {}): ResolvedEndpoint {
  return {
    name: 'server',
    provider: 'lmstudio',
    url: 'http://embed.example/v1',
    lanes: ['fast', 'background'],
    batch: 32,
    modelTag: DEFAULT_LMSTUDIO_MODEL_TAG,
    primary: true,
    apiModel: 'bge-m3',
    ...overrides,
  };
}

type MockChunk = { id: string; content: string; worker?: string; embedding?: boolean };

class MockClaimDb {
  chunks: MockChunk[] = [];
  leaseSeconds = 300;

  claim(worker: string, lane: string, limit: number): MockChunk[] {
    const tier0 = this.chunks.some((c) => c.id.startsWith('t0-') && !c.embedding);
    if (lane === 'background' && tier0) return [];
    const picked: MockChunk[] = [];
    for (const c of this.chunks) {
      if (c.embedding || c.worker) continue;
      if (lane === 'fast' && !c.id.startsWith('t0-')) continue;
      if (lane === 'background' && c.id.startsWith('t0-')) continue;
      c.worker = worker;
      picked.push(c);
      if (picked.length >= limit) break;
    }
    return picked;
  }

  save(worker: string, ids: string[]): number {
    let saved = 0;
    for (const id of ids) {
      const c = this.chunks.find((x) => x.id === id);
      if (!c || c.worker !== worker || c.embedding) continue;
      c.embedding = true;
      c.worker = undefined;
      saved += 1;
    }
    return saved;
  }

  release(worker: string): void {
    for (const c of this.chunks) {
      if (c.worker === worker) c.worker = undefined;
    }
  }
}

async function main(): Promise<void> {
  assert.equal(PREFLIGHT_TEXT_COUNT, 20);

  assert.equal(selectClaimLane(primaryEndpoint(), true), 'fast');
  assert.equal(selectClaimLane(primaryEndpoint(), false), 'background');
  assert.equal(
    selectClaimLane(
      primaryEndpoint({ primary: false, lanes: ['background'], name: 'pc' }),
      true,
    ),
    null,
  );
  assert.equal(
    selectClaimLane(
      primaryEndpoint({ primary: false, lanes: ['background'], name: 'pc' }),
      false,
    ),
    'background',
  );

  const health = new EndpointHealth(100, 5000);
  health.recordFailure();
  assert.ok(health.isBackingOff());
  health.markPreflightPassed();
  assert.equal(health.isBackingOff(), false);

  const secret = 'sk-live-abcdefgh-1234567890';
  process.env.EMBED_TEST_API_KEY = secret;
  const key = resolveApiKeyFromEnvVarName('EMBED_TEST_API_KEY');
  assert.equal(key, secret);
  assert.throws(() =>
    resolveEndpointConfig({
      name: 'x',
      provider: 'lmstudio',
      url: '',
      primary: true,
    }),
  );

  const epJson = parseEndpointJson(
    JSON.stringify({
      name: 'gaming-pc',
      provider: 'lmstudio',
      url: 'https://pc.example/v1',
      lanes: ['background'],
      apiKeyEnv: 'EMBED_TEST_API_KEY',
    }),
    'test',
  );
  const endpoints = finalizeEndpoints([
    { name: 'server', provider: 'lmstudio', url: 'https://srv/v1', primary: true },
    epJson,
  ]);
  assert.equal(endpoints[1].apiKey, secret);
  assert.ok(!JSON.stringify(epJson).includes(secret));

  const logs: string[] = [];
  const err = new Error(`Auth failed Bearer ${secret}`);
  logs.push(safeErrorMessage(err, [secret]));
  assert.ok(!logs.join('').includes(secret));
  assert.ok(
    logs.join('').includes(maskSecret(secret)) || logs.join('').includes('Bearer ***'),
  );

  const db = new MockClaimDb();
  db.chunks = [
    { id: 't0-a', content: 'a' },
    { id: 't0-b', content: 'b' },
    { id: 'bg-1', content: 'c' },
  ];
  const w1 = 'server@1';
  const w2 = 'pc@2';
  const c1 = db.claim(w1, 'fast', 10);
  assert.equal(c1.length, 2);
  const c2 = db.claim(w2, 'fast', 10);
  assert.equal(c2.length, 0);
  const dup = db.claim(w1, 'fast', 10);
  assert.equal(dup.length, 0);
  db.save(w1, ['t0-a']);
  assert.equal(db.save(w1, ['t0-a']), 0);
  db.release(w2);
  const bg = db.claim(w2, 'background', 10);
  assert.equal(bg.length, 0);
  db.chunks.forEach((c) => {
    if (c.id.startsWith('t0-')) c.embedding = true;
  });
  const bg2 = db.claim(w2, 'background', 10);
  assert.equal(bg2.length, 1);

  const a = [1, 0, 0];
  const b = [1, 0, 0];
  assert.ok(cosineSimilarity(a, b) >= 0.99);

  delete process.env.EMBED_TEST_API_KEY;

  console.log('backfill-embedding-v2-multi.test.ts: ok');
}

void main();
