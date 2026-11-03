import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  buildTopicBriefWebhookPayloadForDocs,
  buildTopicBriefWebhookPayloadRedditDocs,
} from '@/lib/admin/research/topic-webhook-body';
import { signResearchWebhookPayload } from '@/lib/admin/research/webhook';
import { researchTopicWebhookPath } from '@/lib/admin/research/topic-types';

assert.equal(researchTopicWebhookPath(), 'folkets-research-topic-brief');

const clusterPayload = buildTopicBriefWebhookPayloadForDocs();
assert.equal(clusterPayload.kind, 'topic_brief');
assert.ok(clusterPayload.title);
assert.equal(clusterPayload.source_kind, 'cluster');
assert.ok((clusterPayload.context as { summary?: string }).summary?.trim());

const redditPayload = buildTopicBriefWebhookPayloadRedditDocs();
assert.equal(redditPayload.source_ref, '1xlz4r8');
assert.equal(redditPayload.title, undefined);

const rawBody = JSON.stringify(clusterPayload);
const sig = signResearchWebhookPayload('secret', '1700000000', rawBody);
assert.match(sig, /^sha256=[a-f0-9]{64}$/);
assert.equal(
  createHmac('sha256', 'secret').update(`1700000000.${rawBody}`).digest('hex'),
  sig.replace(/^sha256=/, ''),
);

console.log('lib/admin/research/topic-webhook.test.ts: ok');
