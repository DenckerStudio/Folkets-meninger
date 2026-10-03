import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const n8nDir = join(process.cwd(), 'workflows/n8n');

function readWorkflow(name: string): string {
  return readFileSync(join(n8nDir, name), 'utf8');
}

const productionFlows = [
  'ai-summary-backfill.workflow.ts',
  'document-embeddings.workflow.ts',
  'system-poll-draft.workflow.ts',
  'app-cron.workflow.ts',
  'hearing-innspill-package.workflow.ts',
  'pipeline-health.workflow.ts',
];

for (const file of productionFlows) {
  const src = readWorkflow(file);
  assert.match(src, /createInWorkflowErrorNotify/, `${file} must include in-workflow Error Trigger notify`);
  assert.match(src, /\/api\/ops\/n8n-notify/, `${file} must notify via /api/ops/n8n-notify`);
}

const cron = readWorkflow('app-cron.workflow.ts');
assert.match(cron, /\/api\/cron\/n8n-retry/);
assert.match(cron, /Every 2 hours n8n-retry/);

const reels = readWorkflow('system-poll-draft.workflow.ts');
assert.match(reels, /rpc\/create_system_poll_draft/);
assert.doesNotMatch(reels, /rpc\/ensure_stortinget_poll/);
assert.match(reels, /ALDRI ensure_stortinget_poll/);
assert.match(reels, /ja\/nei\/blank/);

const shared = readWorkflow('system-poll-draft.shared.ts');
assert.match(shared, /create_system_poll_draft|SYSTEM_POLL_GENERATOR/);
assert.doesNotMatch(shared, /ensure_stortinget_poll/);
assert.match(shared, /fallback_chunks/);
assert.doesNotMatch(shared, /select\(['"]embedding['"]\)/);

const errorHandler = readWorkflow('ops-error-handler.workflow.ts');
assert.match(errorHandler, /Error Trigger/);
assert.match(errorHandler, /\/api\/ops\/n8n-notify/);

const inWorkflow = readWorkflow('in-workflow-error-notify.ts');
assert.match(inWorkflow, /name: 'Error Trigger'/);
assert.match(inWorkflow, /\/api\/cron\/n8n-retry/);

console.log('n8n/workflow-source.test.ts: ok Error Trigger + n8n-retry + Reels draft RPC');
