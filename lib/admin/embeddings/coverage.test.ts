import assert from 'node:assert/strict';
import { mapAdminEmbeddingCoverage, embeddingCoverageNotReady } from '@/lib/admin/embeddings/coverage';

const mapped = mapAdminEmbeddingCoverage({
  generatedAt: '2026-11-15T12:00:00.000Z',
  legacy: {
    dimension: 768,
    modelTag: 'nomic-embed-text',
    ready: 100,
    pending: 10,
    failed: 2,
    lastReadyAt: '2026-11-10T08:00:00.000Z',
  },
  v2: {
    dimension: 1024,
    ready: 50,
    pending: 5,
    failed: 1,
    missingVector: 20,
    models: [{ model_tag: 'bge-m3', chunk_count: 50 }],
    lastRunAt: '2026-11-14T22:00:00.000Z',
  },
  issues: {
    total: 1000,
    withChunks: 800,
    withoutChunks: 200,
    shareWithoutChunks: 0.2,
  },
  backlogHealth: { pending_v2_total: 5 },
});

assert.equal(mapped.ready, true);
assert.equal(mapped.legacy?.ready, 100);
assert.equal(mapped.v2?.models[0]?.modelTag, 'bge-m3');
assert.equal(mapped.issues?.shareWithoutChunks, 0.2);
assert.equal(embeddingCoverageNotReady.ready, false);

console.log('lib/admin/embeddings/coverage.test.ts: ok');