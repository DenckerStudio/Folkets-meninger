import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const n8nDir = join(process.cwd(), 'workflows/n8n');

function evaluateIssueIdGuard(normalized: { issueId?: unknown }): boolean {
  const id = String(normalized.issueId ?? '').trim();
  return id.length > 0;
}

async function main(): Promise<void> {
  const mod = await import(
    pathToFileURL(join(n8nDir, 'document-embeddings.workflow.ts')).href
  );
  const fromTs = mod.default.toJSON() as {
    connections: Record<string, { main: { node: string; type: string; index: number }[][] }>;
    nodes: { name: string; parameters?: { conditions?: { conditions?: { leftValue?: string }[] } } }[];
  };
  const fromDisk = JSON.parse(
    readFileSync(join(n8nDir, 'document-embeddings.n8n.json'), 'utf8'),
  ) as typeof fromTs;

  assert.deepEqual(
    fromDisk.connections['Webhook document embeddings'],
    fromTs.connections['Webhook document embeddings'],
    'Webhook entry must match between committed JSON and workflow source',
  );
  assert.deepEqual(
    fromDisk.connections['Normalize webhook payload'],
    fromTs.connections['Normalize webhook payload'],
    'Normalize must feed Has issue id? in committed JSON and workflow source',
  );
  assert.deepEqual(
    fromDisk.connections['Has issue id?'],
    fromTs.connections['Has issue id?'],
    'Guard branches must match between JSON and workflow source',
  );
  assert.match(
    JSON.stringify(fromDisk.connections['Webhook document embeddings']),
    /Normalize webhook payload/,
    'Webhook must connect to Normalize before the guard',
  );

  const guardNode = fromDisk.nodes.find((n) => n.name === 'Has issue id?');
  const guardExpr = guardNode?.parameters?.conditions?.conditions?.[0]?.leftValue ?? '';
  assert.match(guardExpr, /issueId/);

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
