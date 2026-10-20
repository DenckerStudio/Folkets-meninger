import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'lib/n8n/retry-pending.ts'), 'utf8');

assert.match(src, /AI_SUMMARY_PENDING_SCAN_LIMIT = 200/);
assert.match(src, /\.order\('last_synced_at', \{ ascending: true \}\)/);
assert.match(src, /\.in\('stortinget_issue_id', candidateIds\)/);
assert.match(src, /ai_summary_requested_at: requestedNow/);
assert.doesNotMatch(src, /\.from\('issue_ai_summaries'\)\.select\('stortinget_issue_id'\)\s*;/);

console.log('retry-pending.test.ts: ok');
