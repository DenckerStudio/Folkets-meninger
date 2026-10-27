import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'lib/n8n/retry-pending.ts'), 'utf8');

assert.match(src, /AI_SUMMARY_PENDING_SCAN_LIMIT = 200/);
assert.match(src, /\.order\('ai_summary_requested_at', \{ ascending: true, nullsFirst: true \}\)/);
assert.match(src, /\.order\('last_synced_at', \{ ascending: true \}\)/);
assert.match(src, /\.in\('stortinget_issue_id', candidateIds\)/);
assert.match(src, /Date\.parse\(issue\.ai_summary_requested_at\)/);
assert.match(src, /claimAiSummaryWebhook\(issue\.id\)/);
assert.doesNotMatch(src, /\.from\('issue_ai_summaries'\)\.select\('stortinget_issue_id'\)\s*;/);
assert.doesNotMatch(src, /triggerDocumentEmbeddingsWebhook/);
assert.doesNotMatch(src, /listPendingLegacyEmbeddingIssueIds/);
assert.doesNotMatch(src, /isLegacyEmbeddingsRetryEnabled/);

console.log('retry-pending.test.ts: ok');
