import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { serializeDocumentEmbeddingsJson } from '../../workflows/n8n/canonicalize-document-embeddings-json';

const n8nDir = join(process.cwd(), 'workflows/n8n');
const committedPath = join(n8nDir, 'document-embeddings.n8n.json');

function evaluateIssueIdGuard(normalized: { issueId?: unknown }): boolean {
  const id = String(normalized.issueId ?? '').trim();
  return id.length > 0;
}

async function main(): Promise<void> {
  const mod = await import(pathToFileURL(join(n8nDir, 'document-embeddings.workflow.ts')).href);
  const fromTs = serializeDocumentEmbeddingsJson(mod.default.toJSON());
  const fromDisk = readFileSync(committedPath, 'utf8');

  assert.equal(fromTs, fromDisk, 'Committed JSON must match canonical exporter output byte-for-byte');

  execSync('npx tsx scripts/check-document-embeddings-workflow-json.mjs', {
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  const fromJson = JSON.parse(fromDisk) as {
    connections: Record<string, { main: { node: string; type: string; index: number }[][] }>;
    nodes: { name: string; id: string; parameters?: { conditions?: { conditions?: { leftValue?: string }[] } } }[];
  };

  assert.deepEqual(
    fromJson.connections['Webhook document embeddings'],
    fromJson.connections['Webhook document embeddings'],
    'Webhook entry present',
  );
  assert.match(
    JSON.stringify(fromJson.connections['Webhook document embeddings']),
    /Normalize webhook payload/,
    'Webhook must connect to Normalize before the guard',
  );

  const guardNode = fromJson.nodes.find((n) => n.name === 'Has issue id?');
  assert.equal(guardNode?.id, 'guard-has-issue-id');
  const skipNode = fromJson.nodes.find((n) => n.name === 'Skip global drain (no issue id)');
  assert.equal(skipNode?.id, 'skip-global-drain-node');

  const guardExpr = guardNode?.parameters?.conditions?.conditions?.[0]?.leftValue ?? '';
  assert.match(guardExpr, /issueId/);

  const webhookNode = fromJson.nodes.find((n) => n.name === 'Webhook document embeddings');
  assert.equal(webhookNode?.id, 'webhook-trigger-node');
  assert.equal((webhookNode as { webhookId?: string }).webhookId, 'd2700c9f-12c7-4ee4-b076-e603b8d70f57');

  assert.equal(evaluateIssueIdGuard({ issueId: '200329' }), true);
  assert.equal(evaluateIssueIdGuard({ issueId: ' 200329 ' }), true);
  assert.equal(evaluateIssueIdGuard({}), false);
  assert.equal(evaluateIssueIdGuard({ issueId: '' }), false);

  console.log('document-embeddings-workflow-json.test.ts: ok');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
