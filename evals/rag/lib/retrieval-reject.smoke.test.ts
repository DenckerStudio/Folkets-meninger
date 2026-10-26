import assert from 'node:assert/strict';
import { shouldRejectAfterRerank } from './rerank';

async function main() {
  assert.equal(typeof shouldRejectAfterRerank, 'function');
  assert.equal(shouldRejectAfterRerank(false, 0.02), false);
  assert.equal(shouldRejectAfterRerank(true, 0.01), true);
  await import('./retrieval');
  console.log('evals/rag/lib/retrieval-reject.smoke.test.ts: ok');
}

void main();
