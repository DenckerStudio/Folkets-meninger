import assert from 'node:assert/strict';
import {
  AI_SUMMARY_WEBHOOK_MAX_IN_FLIGHT,
  drainAiSummaryWebhookQueue,
  enqueueAiSummaryWebhook,
  resetAiSummaryWebhookQueueForTests,
} from './webhook-dispatch';

async function main(): Promise<void> {
  assert.ok(AI_SUMMARY_WEBHOOK_MAX_IN_FLIGHT >= 1);
  assert.ok(AI_SUMMARY_WEBHOOK_MAX_IN_FLIGHT <= 2);

  resetAiSummaryWebhookQueueForTests();

  let inFlight = 0;
  let maxInFlight = 0;
  let postCount = 0;

  const deps = {
    url: 'https://n8n.example.invalid/webhook/ai-summary',
    postWebhook: async () => {
      postCount += 1;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 30));
      inFlight -= 1;
      return true;
    },
  };

  for (let i = 0; i < 8; i += 1) {
    enqueueAiSummaryWebhook(String(100_000 + i), deps);
  }

  await drainAiSummaryWebhookQueue(deps);

  assert.equal(postCount, 8);
  assert.ok(maxInFlight <= AI_SUMMARY_WEBHOOK_MAX_IN_FLIGHT);
  assert.ok(maxInFlight >= 1);

  resetAiSummaryWebhookQueueForTests();
  console.log('lib/ai-summary/webhook-dispatch.test.ts: ok');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
