#!/usr/bin/env node
/**
 * Deploy forum v12 prompt generator from bundled SDK source (full graph copy).
 *
 * Usage:
 *   node scripts/deploy-forum-v12-prompt-generator.mjs
 *   # MCP validate_workflow + create_workflow_from_code → TEMP_ID
 *   node scripts/deploy-forum-v12-prompt-generator.mjs --temp-id <TEMP_ID> [--publish]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N8N_BASE = process.env.N8N_API_URL || 'https://n8n.heyklever.app';
const PROMPT_WORKFLOW_ID = process.env.N8N_FORUM_PROMPT_WORKFLOW_ID || 'vOP2zPflfT0yBvDQ';

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
      if (!process.env[line.slice(0, i).trim()]) process.env[line.slice(0, i).trim()] = v;
    }
  }
}

function bundle(outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const r = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/bundle-forum-prompt-generator-workflow.mjs'), outPath],
    { cwd: root, encoding: 'utf8' },
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
}

/** Agent onError continueErrorOutput → Mark cluster failed (output index 1). */
function wireAgentErrorConnection(connections) {
  const agentName = 'Prompt generator (Ollama)';
  const failName = 'Mark cluster failed';
  if (!connections[agentName]) connections[agentName] = { main: [[], []] };
  if (!Array.isArray(connections[agentName].main)) connections[agentName].main = [[], []];
  if (connections[agentName].main.length < 2) {
    while (connections[agentName].main.length < 2) connections[agentName].main.push([]);
  }
  connections[agentName].main[1] = [{ node: failName, type: 'main', index: 0 }];
  return connections;
}

async function main() {
  loadEnv();
  const key = process.env.N8N_API_KEY;
  if (!key) throw new Error('N8N_API_KEY missing (.env.local)');

  const tempArg = process.argv.indexOf('--temp-id');
  if (tempArg < 0) {
    const bundledPath = path.join(root, '.tmp/forum-prompt-generator-bundled.ts');
    bundle(bundledPath);
    console.log(
      JSON.stringify({
        step: 'bundle_ok',
        bundledPath,
        targetId: PROMPT_WORKFLOW_ID,
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

  const [target, temp] = await Promise.all([getWorkflow(PROMPT_WORKFLOW_ID), getWorkflow(tempId)]);
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
  }

  const connections = wireAgentErrorConnection(JSON.parse(JSON.stringify(temp.connections)));

  const put = await fetch(`${N8N_BASE}/api/v1/workflows/${PROMPT_WORKFLOW_ID}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      name: 'Folkets Stemme – Forum JA/NEI prompt generator (v12)',
      nodes,
      connections,
      settings: { executionOrder: 'v1' },
      staticData: target.staticData ?? null,
    }),
  });
  if (!put.ok) throw new Error(`PUT failed: ${put.status} ${await put.text()}`);

  console.log(JSON.stringify({ ok: true, workflowId: PROMPT_WORKFLOW_ID, nodeCount: nodes.length, tempId }));

  if (process.argv.includes('--publish')) {
    const pub = await fetch(`${N8N_BASE}/api/v1/workflows/${PROMPT_WORKFLOW_ID}/activate`, {
      method: 'POST',
      headers: { 'X-N8N-API-KEY': key },
    });
    if (!pub.ok) throw new Error(`Activate failed: ${pub.status} ${await pub.text()}`);
    console.log(JSON.stringify({ published: true, workflowId: PROMPT_WORKFLOW_ID }));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
