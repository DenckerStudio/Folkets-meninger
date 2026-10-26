import assert from 'node:assert/strict';
import { fetchLmStudioEmbedVectors } from './backfill-embedding-v2/lmstudio';

async function main(): Promise<void> {
  const secret = 'sk-lmstudio-test-key-abcdef';
  const fetchImpl = async () => {
    throw new Error(`Bearer ${secret} rejected`);
  };

  let message = '';
  try {
    await fetchLmStudioEmbedVectors('http://lmstudio-host.example.invalid/v1', ['x'], {
      fetchImpl,
      apiKey: secret,
    });
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }

  assert.ok(message.length > 0);
  assert.ok(!message.includes(secret));
  assert.match(message, /Bearer \*\*\*/);

  console.log('backfill-embedding-v2-lmstudio.test.ts: ok');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
