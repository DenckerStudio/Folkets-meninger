#!/usr/bin/env node
/**
 * Deploy forum v13 sak-RAG prompt generator from bundled SDK source.
 *
 * Usage:
 *   node scripts/deploy-forum-v13-sak-prompt-generator.mjs
 *   # MCP validate_workflow + create_workflow_from_code → TEMP_ID
 *   node scripts/deploy-forum-v13-sak-prompt-generator.mjs --temp-id <TEMP_ID> [--publish]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N8N_BASE = process.env.N8N_API_URL || 'https://n8n.heyklever.app';
const SAK_PROMPT_WORKFLOW_ID = process.env.N8N_FORUM_SAK_PROMPT_WORKFLOW_ID || '';

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
    [path.join(root, 'scripts/bundle-forum-sak-prompt-generator-workflow.mjs'), outPath],
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
  if (!key) throw new Error('N8N_API_KEY missing (.env.local)');

  const tempArg = process.argv.indexOf('--temp-id');
  if (tempArg < 0) {
    const bundledPath = path.join(root, '.tmp/forum-sak-prompt-generator-bundled.ts');
    bundle(bundledPath);
    console.log(
      JSON.stringify({
        step: 'bundle_ok',
        bundledPath,
        targetId: SAK_PROMPT_WORKFLOW_ID || '(new workflow)',
        hint: 'Run MCP validate_workflow + create_workflow_from_code, then --temp-id <id> [--publish]',
      }),
    );
    process.exit(2);
  }

  const tempId = process.argv[tempArg + 1];
  const publish = process.argv.includes('--publish');
  const bundledPath = path.join(root, '.tmp/forum-sak-prompt-generator-bundled.ts');
  bundle(bundledPath);

  const getRes = await fetch(`${N8N_BASE}/api/v1/workflows/${tempId}`, {
    headers: { 'X-N8N-API-KEY': key },
  });
  if (!getRes.ok) throw new Error(`GET temp workflow failed: ${getRes.status}`);
  const tempWf = await getRes.json();

  const targetId = SAK_PROMPT_WORKFLOW_ID || tempId;
  const method = SAK_PROMPT_WORKFLOW_ID ? 'PUT' : 'POST';
  const url =
    method === 'PUT'
      ? `${N8N_BASE}/api/v1/workflows/${targetId}`
      : `${N8N_BASE}/api/v1/workflows`;

  const body = {
    name: tempWf.name,
    nodes: tempWf.nodes,
    connections: tempWf.connections,
    settings: tempWf.settings ?? {},
  };

  const putRes = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': key },
    body: JSON.stringify(body),
  });
  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`Deploy failed ${putRes.status}: ${err}`);
  }
  const deployed = await putRes.json();

  if (publish) {
    const pubRes = await fetch(`${N8N_BASE}/api/v1/workflows/${deployed.id}/activate`, {
      method: 'POST',
      headers: { 'X-N8N-API-KEY': key },
    });
    if (!pubRes.ok) throw new Error(`Activate failed: ${pubRes.status}`);
  }

  console.log(
    JSON.stringify({
      ok: true,
      workflowId: deployed.id,
      published: publish,
      webhook: `${N8N_BASE}/webhook/folkets-forum-sak-prompt-generator`,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
