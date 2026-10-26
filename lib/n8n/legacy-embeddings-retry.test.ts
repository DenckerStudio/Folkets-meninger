import assert from 'node:assert/strict';
import { isLegacyEmbeddingsRetryEnabled } from './legacy-embeddings-retry';

const prev = process.env.N8N_RETRY_LEGACY_EMBEDDINGS;

function restore(): void {
  if (prev === undefined) delete process.env.N8N_RETRY_LEGACY_EMBEDDINGS;
  else process.env.N8N_RETRY_LEGACY_EMBEDDINGS = prev;
}

assert.equal(isLegacyEmbeddingsRetryEnabled(), false);
process.env.N8N_RETRY_LEGACY_EMBEDDINGS = 'true';
assert.equal(isLegacyEmbeddingsRetryEnabled(), true);
process.env.N8N_RETRY_LEGACY_EMBEDDINGS = '1';
assert.equal(isLegacyEmbeddingsRetryEnabled(), true);
restore();
assert.equal(isLegacyEmbeddingsRetryEnabled(), false);

console.log('legacy-embeddings-retry.test.ts: ok');
