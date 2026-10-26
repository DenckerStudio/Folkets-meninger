import assert from 'node:assert/strict';
import {
  PIPELINE_EMBEDDING_CATCHUP_CONCURRENCY,
  runEmbeddingCatchupWebhooks,
} from './pipeline-catchup';

async function main(): Promise<void> {
  assert.ok(PIPELINE_EMBEDDING_CATCHUP_CONCURRENCY >= 3);
  assert.ok(PIPELINE_EMBEDDING_CATCHUP_CONCURRENCY <= 5);

  const prev = process.env.N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL;
  process.env.N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL = 'http://n8n.example.invalid/webhook';

  let inFlight = 0;
  let maxInFlight = 0;

  await runEmbeddingCatchupWebhooks(
    Array.from({ length: 12 }, (_, i) => String(200_000 + i)),
    {
      postWebhook: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 25));
        inFlight -= 1;
        return true;
      },
    },
  );

  assert.ok(maxInFlight <= PIPELINE_EMBEDDING_CATCHUP_CONCURRENCY);
  assert.ok(maxInFlight > 1, 'expected parallel webhook posts');

  if (prev === undefined) {
    delete process.env.N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL;
  } else {
    process.env.N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL = prev;
  }

  console.log('pipeline-catchup-concurrency.test.ts: ok');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
