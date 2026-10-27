import assert from 'node:assert/strict';
import { runRegenerationWebhookRetry } from './retry-pending';

async function main(): Promise<void> {
  const order: string[] = [];

  const ok = await runRegenerationWebhookRetry('42', {
    claim: async (id) => {
      order.push(`claim:${id}`);
      return true;
    },
    deleteSummary: async (id) => {
      order.push(`delete:${id}`);
    },
    triggerWebhook: (id) => {
      order.push(`trigger:${id}`);
    },
  });

  assert.equal(ok, true);
  assert.deepEqual(order, ['claim:42', 'delete:42', 'trigger:42']);

  order.length = 0;
  const lostClaim = await runRegenerationWebhookRetry('99', {
    claim: async () => {
      order.push('claim');
      return false;
    },
    deleteSummary: async () => {
      order.push('delete');
    },
    triggerWebhook: () => {
      order.push('trigger');
    },
  });

  assert.equal(lostClaim, false);
  assert.deepEqual(order, ['claim'], 'delete must be skipped when claim fails');

  console.log('retry-pending-regeneration.test.ts: ok');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
