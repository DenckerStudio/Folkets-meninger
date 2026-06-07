#!/usr/bin/env node
/**
 * DEPRECATED v9 — scout v11 uses bundle + MCP deploy. Do not run against live workflow.
 * v9 discovery: end pipeline after Save articles; set pending_review in Prepare cluster saves.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW_ID = 'mjiQBSdxVv0sAuMu';
const N8N_BASE = process.env.N8N_API_URL || 'https://n8n.heyklever.app';

function loadEnv() {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[line.slice(0, i).trim()] = v;
  }
}

function unescapeJs(s) {
  return s.replace(/\\\\/g, '\\');
}

function extractConst(from, name) {
  const m = from.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`, 'm'));
  if (!m) throw new Error(`missing ${name}`);
  return unescapeJs(m[1]);
}

function extractExport(from, name) {
  const m = from.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`, 'm'));
  if (!m) throw new Error(`missing export ${name}`);
  return unescapeJs(m[1]);
}

async function main() {
  loadEnv();
  const key = process.env.N8N_API_KEY;
  if (!key) throw new Error('N8N_API_KEY missing');

  const ingestSrc = fs.readFileSync(path.join(root, 'workflows/n8n/forum-prompt-ingest.shared.ts'), 'utf8');
  const discoverySrc = fs.readFileSync(
    path.join(root, 'workflows/n8n/forum-research-discovery.workflow.ts'),
    'utf8',
  );

  const raw = await fetch(`${N8N_BASE}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': key },
  }).then((r) => r.json());
  const wf = raw.data ?? raw;

  const ctx = wf.nodes.find((n) => n.name === 'Fetch discovery context');
  if (ctx) ctx.parameters.query = extractExport(ingestSrc, 'DISCOVERY_CONTEXT_SQL');

  const prep = wf.nodes.find((n) => n.name === 'Prepare cluster saves');
  if (prep) prep.parameters.jsCode = extractConst(discoverySrc, 'PREPARE_CLUSTER_SAVES_JS');

  const enrich = wf.nodes.find((n) => n.name === 'Enrich story articles');
  if (enrich) {
    enrich.parameters.jsCode = extractExport(
      fs.readFileSync(path.join(root, 'workflows/n8n/forum-article-enrich.shared.ts'), 'utf8'),
      'ENRICH_STORY_ARTICLES_JS',
    );
  }

  wf.connections = wf.connections || {};
  wf.connections['Save articles'] = { main: [[]] };

  const put = await fetch(`${N8N_BASE}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Folkets Stemme – Forum research discovery (v9)',
      nodes: wf.nodes,
      connections: wf.connections,
      settings: { executionOrder: wf.settings?.executionOrder || 'v1' },
    }),
  });
  const body = await put.json();
  if (!put.ok) throw new Error(JSON.stringify(body).slice(0, 800));
  console.log('v9 discovery topology: Save articles is terminal; pending_review + context SQL updated');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
