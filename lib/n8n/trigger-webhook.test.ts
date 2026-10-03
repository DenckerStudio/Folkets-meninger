import assert from 'node:assert/strict';
import { postN8nWebhook, triggerN8nWebhook } from './trigger-webhook';

assert.equal(
  triggerN8nWebhook({ kind: 'ai-summary', url: undefined, body: { id: '1' } }),
  false,
  'missing url is not queued',
);

assert.equal(
  triggerN8nWebhook({ kind: 'ai-summary', url: '   ', body: {} }),
  false,
  'blank url is not queued',
);

const originalFetch = globalThis.fetch;
const calls: { url: string; init?: RequestInit }[] = [];
let failCount = 0;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url: String(input), init });
  if (failCount > 0) {
    failCount -= 1;
    throw new Error('network down');
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}) as typeof fetch;

failCount = 1;
const recovered = await postN8nWebhook('https://n8n.example/webhook', { id: '200329' }, 'ai-summary', 200, 2);
assert.equal(recovered, true, 'retries after first failure');
assert.equal(calls.length, 2, 'two attempts');
assert.equal(calls[0]?.init?.method, 'POST');
const headers = calls[0]?.init?.headers as Record<string, string> | undefined;
assert.equal(headers?.['Content-Type'], 'application/json');

calls.length = 0;
failCount = 2;
const exhausted = await postN8nWebhook('https://n8n.example/webhook', {}, 'system-poll-draft', 200, 2);
assert.equal(exhausted, false, 'returns false after retries');
assert.equal(calls.length, 2, 'exhausted both attempts');

globalThis.fetch = originalFetch;
console.log('n8n trigger webhook tests OK');
