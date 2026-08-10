#!/usr/bin/env node
/**
 * Deploy forum scout v11: bundle → MCP create_workflow_from_code (temp) → copy graph to j6NZpV4IHP0AHFVj.
 * Or run the inline REST copy after MCP temp id (see workflows/n8n/FORUM-PROMPTS-v10.md).
 *
 * Usage:
 *   node scripts/bundle-forum-research-discovery-workflow.mjs .tmp/forum-scout-v11-bundled.ts
 *   # MCP: validate_workflow + create_workflow_from_code → TEMP_ID
 *   node scripts/deploy-forum-scout-v11.mjs --temp-id <TEMP_ID> [--publish]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_ID = 'j6NZpV4IHP0AHFVj';
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
    [path.join(root, 'scripts/bundle-forum-research-discovery-workflow.mjs'), outPath],
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
    const bundledPath = path.join(root, '.tmp/forum-scout-v11-bundled.ts');
    bundle(bundledPath);
    console.log(
      JSON.stringify({
        step: 'bundle_ok',
        bundledPath,
        targetId: TARGET_ID,
        hint: 'Run MCP validate_workflow + create_workflow_from_code, then --temp-id <id>',
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
    if (node.type === '@n8n/n8n-nodes-langchain.lmChatOllama') {
      const c = byName.get('Ollama account');
      if (c) node.credentials = { ollamaApi: { id: c.id, name: c.name } };
    }
    if (node.type === '@n8n/n8n-nodes-langchain.toolSearXng') {
      const c = byName.get('SearXNG account');
      if (c) node.credentials = { searXngApi: { id: c.id, name: c.name } };
    }
  }

  const put = await fetch(`${N8N_BASE}/api/v1/workflows/${TARGET_ID}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      name: 'Folkets Stemme – Forum story scout (v11.1)',
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
