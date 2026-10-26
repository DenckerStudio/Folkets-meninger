import assert from 'node:assert/strict';
import { buildN8nWebhookHeaders } from './n8n-webhook-headers';

assert.equal(buildN8nWebhookHeaders()['X-FM-Webhook-Token'], undefined);
assert.equal(buildN8nWebhookHeaders('')['X-FM-Webhook-Token'], undefined);
assert.equal(buildN8nWebhookHeaders('   ')['X-FM-Webhook-Token'], undefined);
assert.equal(buildN8nWebhookHeaders('  sekret  ')['X-FM-Webhook-Token'], 'sekret');
assert.equal(buildN8nWebhookHeaders('sekret')['Content-Type'], 'application/json');

console.log('n8n-webhook-headers.test.ts: ok');
