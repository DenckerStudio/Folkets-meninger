import assert from 'node:assert/strict';
import {
  getMissingResearchWebhookEnvKeys,
  mapResearchWebhookFailure,
} from '@/lib/admin/research/webhook-errors';

assert.deepEqual(
  mapResearchWebhookFailure({ reason: 'http', status: 404 }),
  {
    code: 'research_webhook_inactive',
    message: 'Arbeidsflyten er ikke aktiv i n8n.',
    briefError: 'webhook_http_404',
    httpStatus: 502,
  },
);

assert.deepEqual(
  mapResearchWebhookFailure({ reason: 'http', status: 403 }).message,
  'Webhook-token ble avvist.',
);

assert.match(
  mapResearchWebhookFailure({ reason: 'http', status: 503 }).message,
  /feilkode 503/,
);

assert.equal(
  mapResearchWebhookFailure({ reason: 'timeout' }).code,
  'research_webhook_timeout',
);

const configuredKeys = {
  N8N_RESEARCH_WEBHOOK_BASE: 'https://example.test/webhook',
  N8N_RESEARCH_WEBHOOK_SECRET: 'secret',
  N8N_RESEARCH_WEBHOOK_TOKEN: 'token',
};
const prev = { ...process.env };
process.env = { ...process.env, ...configuredKeys };
assert.deepEqual(getMissingResearchWebhookEnvKeys(), []);
delete process.env.N8N_RESEARCH_WEBHOOK_TOKEN;
assert.deepEqual(getMissingResearchWebhookEnvKeys(), ['N8N_RESEARCH_WEBHOOK_TOKEN']);
const notConfigured = mapResearchWebhookFailure({ reason: 'not_configured' });
assert.match(notConfigured.message, /N8N_RESEARCH_WEBHOOK_TOKEN/);
assert.equal(notConfigured.httpStatus, 503);
process.env = prev;

console.log('webhook-errors.test.ts: ok');
