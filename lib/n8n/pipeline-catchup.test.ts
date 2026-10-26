import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'lib/n8n/pipeline-catchup.ts'), 'utf8');

assert.match(src, /isLegacyEmbeddingsRetryEnabled\(\)/);
assert.match(src, /listPendingLegacyEmbeddingIssueIds/);
assert.match(src, /for \(const issueId of issueIds\)/);
assert.match(src, /triggerDocumentEmbeddingsWebhook\(issueId\)/);
assert.doesNotMatch(src, /triggerDocumentEmbeddingsWebhook\(\s*\)/);

const triggerSrc = readFileSync(
  join(process.cwd(), 'lib/trigger-document-embeddings-webhook.ts'),
  'utf8',
);
assert.match(triggerSrc, /stortinget_issue_id:\s*stortingetIssueId/);
assert.match(src, /N8N_PIPELINE_HEALTH_WEBHOOK_URL/);

console.log('pipeline-catchup.test.ts: ok');
