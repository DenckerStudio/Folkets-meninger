import assert from 'node:assert/strict';
import { triggerAiSummaryWebhook } from './trigger-ai-summary-webhook';

async function run(): Promise<void> {
  const prevUrl = process.env.N8N_AI_SUMMARY_WEBHOOK_URL;
  const prevToken = process.env.N8N_AI_SUMMARY_WEBHOOK_TOKEN;
  process.env.N8N_AI_SUMMARY_WEBHOOK_URL = 'https://n8n.example/webhook/folkets-ai-summary';
  process.env.N8N_AI_SUMMARY_WEBHOOK_TOKEN = 'env-token-from-coolify';

  const originalFetch = globalThis.fetch;
  const inits: RequestInit[] = [];
  globalThis.fetch = (async (_input, init) => {
    inits.push(init ?? {});
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    triggerAiSummaryWebhook('200329');
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(inits.length >= 1, true, 'webhook POST was sent');
    const headers = inits[0]?.headers as Record<string, string> | undefined;
    assert.equal(headers?.['X-FM-Webhook-Token'], 'env-token-from-coolify');
  } finally {
    globalThis.fetch = originalFetch;
    if (prevUrl === undefined) delete process.env.N8N_AI_SUMMARY_WEBHOOK_URL;
    else process.env.N8N_AI_SUMMARY_WEBHOOK_URL = prevUrl;
    if (prevToken === undefined) delete process.env.N8N_AI_SUMMARY_WEBHOOK_TOKEN;
    else process.env.N8N_AI_SUMMARY_WEBHOOK_TOKEN = prevToken;
  }

  console.log('trigger-ai-summary-webhook.test.ts: ok');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
