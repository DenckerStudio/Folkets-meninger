#!/usr/bin/env node
/**
 * Deploy forum v12 Regjeringen RSS ingest from bundled SDK source.
 *
 * Usage:
 *   node scripts/deploy-forum-v12-rss-ingest.mjs
 *   # MCP validate_workflow + create_workflow_from_code → TEMP_ID
 *   node scripts/deploy-forum-v12-rss-ingest.mjs --temp-id <TEMP_ID> [--publish]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_ID = process.env.N8N_FORUM_RSS_WORKFLOW_ID || '6yy1ESY2Zy7cWgtF';
const N8N_BASE = process.env.N8N_API_URL || 'https://n8n.heyklever.app';

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const envPath = path.join(root, name);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i < 0) continue;
      let v = line.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[line.slice(0, i).trim()]) {
        process.env[line.slice(0, i).trim()] = v;
      }
    }
  }
}

function bundle(outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const r = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/bundle-forum-regjeringen-rss-workflow.mjs'), outPath],
    { cwd: root, encoding: 'utf8' },
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
}

async function main() {
  loadEnv();
  const key = process.env.N8N_API_KEY;
  if (!key) throw new Error('N8N_API_KEY missing in .env.local');

  const tempArg = process.argv.indexOf('--temp-id');
  if (tempArg < 0) {
    const bundledPath = path.join(root, '.tmp/forum-regjeringen-rss-bundled.ts');
    bundle(bundledPath);
    console.log(
      JSON.stringify({
        step: 'bundle_ok',
        bundledPath,
        targetId: TARGET_ID,
        hint: 'Run MCP validate_workflow + create_workflow_from_code, then --temp-id <id> [--publish]',
      }),
    );
    process.exit(2);
  }

  const tempId = process.argv[tempArg + 1];
  const headers = { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' };

  async function getWorkflow(id) {
    const res = await fetch(`${N8N_BASE}/api/v1/workflows/${id}`, { headers: { 'X-N8N-API-KEY': key } });
    if (!res.ok) throw new Error(`GET ${id}: ${res.status} ${await res.text()}`);
    const json = await res.json();
    return json.data ?? json;
  }

  const credRes = await fetch(`${N8N_BASE}/api/v1/credentials`, { headers: { 'X-N8N-API-KEY': key } });
  const credJson = await credRes.json();
  const creds = credJson.data ?? credJson;
  const byName = new Map((Array.isArray(creds) ? creds : []).map((c) => [c.name, c]));

  const [target, temp] = await Promise.all([getWorkflow(TARGET_ID), getWorkflow(tempId)]);
  const nodes = JSON.parse(JSON.stringify(temp.nodes));
  for (const node of nodes) {
    if (node.type === 'n8n-nodes-base.postgres') {
      const c = byName.get('Fokets Meninger');
      if (c) node.credentials = { postgres: { id: c.id, name: c.name } };
    }
  }

  const put = await fetch(`${N8N_BASE}/api/v1/workflows/${TARGET_ID}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      name: 'Folkets Stemme – Forum Regjeringen RSS ingest (v12.1)',
      nodes,
      connections: temp.connections,
      settings: { executionOrder: 'v1' },
      staticData: target.staticData ?? null,
    }),
  });
  if (!put.ok) throw new Error(`PUT failed: ${put.status} ${await put.text()}`);

  console.log(JSON.stringify({ ok: true, workflowId: TARGET_ID, nodeCount: nodes.length, tempId }));

  if (process.argv.includes('--publish')) {
    const pub = await fetch(`${N8N_BASE}/api/v1/workflows/${TARGET_ID}/activate`, {
      method: 'POST',
      headers: { 'X-N8N-API-KEY': key },
    });
    if (!pub.ok) throw new Error(`Activate failed: ${pub.status} ${await pub.text()}`);
    console.log(JSON.stringify({ published: true, workflowId: TARGET_ID }));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
