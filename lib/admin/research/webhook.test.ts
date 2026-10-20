import assert from 'node:assert/strict';
import {
  isResearchApiAction,
  researchWebhookPathForAction,
} from '@/lib/admin/research/actions';
import { signResearchWebhookPayload } from '@/lib/admin/research/webhook';

assert.equal(isResearchApiAction('deepen'), true);
assert.equal(isResearchApiAction('blog'), true);
assert.equal(isResearchApiAction('nope'), false);

assert.equal(researchWebhookPathForAction('deepen'), 'research-utdyp');
assert.equal(researchWebhookPathForAction('blog'), 'blogg-fra-research');
assert.equal(researchWebhookPathForAction('reel'), 'reel-fra-research');

const sig = signResearchWebhookPayload('test-secret', '1700000000', '{"a":1}');
assert.match(sig, /^sha256=[a-f0-9]{64}$/);

console.log('admin/research/webhook.test.ts: ok');
