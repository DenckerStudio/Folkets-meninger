import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'lib/n8n/pipeline-catchup.ts'), 'utf8');

assert.doesNotMatch(src, /listPendingLegacyEmbeddingIssueIds/);
assert.doesNotMatch(src, /isLegacyEmbeddingsRetryEnabled/);
assert.match(src, /PIPELINE_EMBEDDING_CATCHUP_CONCURRENCY/);
assert.match(src, /embeddingsConfigured/);
assert.match(src, /runEmbeddingCatchupWebhooks/);
assert.match(src, /embeddingIssueIds: string\[\] = \[\]/);
assert.doesNotMatch(src, /for \(const issueId of issueIds\)[\s\S]*triggerDocumentEmbeddingsWebhook/);

const triggerSrc = readFileSync(
  join(process.cwd(), 'lib/trigger-document-embeddings-webhook.ts'),
  'utf8',
);
assert.match(triggerSrc, /stortinget_issue_id:\s*stortingetIssueId/);
assert.match(src, /N8N_PIPELINE_HEALTH_WEBHOOK_URL/);

const routeSrc = readFileSync(
  join(process.cwd(), 'app/api/admin/pipeline-health/route.ts'),
  'utf8',
);
assert.match(routeSrc, /after\(/);
assert.match(routeSrc, /runEmbeddingCatchupWebhooks/);
assert.match(routeSrc, /status:\s*502/);

console.log('pipeline-catchup.test.ts: ok');
