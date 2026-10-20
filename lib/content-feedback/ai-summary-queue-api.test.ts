import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseResetAiSummaryQueueBody } from '@/lib/content-feedback/ai-summary-queue-admin';

const routeSrc = readFileSync(
  join(process.cwd(), 'app/api/admin/ai-summary-queue/route.ts'),
  'utf8',
);
const pipelineHealthWorkflow = readFileSync(
  join(process.cwd(), 'workflows/n8n/pipeline-health.workflow.ts'),
  'utf8',
);
const backfillWorkflow = readFileSync(
  join(process.cwd(), 'workflows/n8n/ai-summary-backfill.workflow.ts'),
  'utf8',
);

assert.match(routeSrc, /requireAdmin\(\)/);
assert.match(routeSrc, /parseResetAiSummaryQueueBody/);
assert.match(routeSrc, /p_admin_user_id: auth\.userId/);
assert.match(routeSrc, /status: 404/);

assert.doesNotMatch(pipelineHealthWorkflow, /n8n_list_issues_missing_ai_summary/);
assert.match(pipelineHealthWorkflow, /n8n_pipeline_health/);
assert.match(backfillWorkflow, /n8n_list_issues_missing_ai_summary/);

const badJson = parseResetAiSummaryQueueBody(null);
assert.equal(badJson.ok, false);
if (!badJson.ok) assert.equal(badJson.status, 400);

const missing = parseResetAiSummaryQueueBody({});
assert.equal(missing.ok, false);

const tooLong = parseResetAiSummaryQueueBody({ issue_id: '1'.repeat(13) });
assert.equal(tooLong.ok, false);

const letters = parseResetAiSummaryQueueBody({ issue_id: 'abc' });
assert.equal(letters.ok, false);

const ok = parseResetAiSummaryQueueBody({ issue_id: '12345' });
assert.equal(ok.ok, true);
if (ok.ok) assert.equal(ok.issueId, '12345');

console.log('content-feedback/ai-summary-queue-api.test.ts: ok');
