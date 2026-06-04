#!/usr/bin/env node
/** Push shared/workflow Code node JS to live mjiQBSdxVv0sAuMu (unescapes TS template backslashes). */
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

function extractExport(from, name) {
  const m = from.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`, 'm'));
  if (!m) throw new Error(`missing export ${name}`);
  return unescapeJs(m[1]);
}

function extractConst(from, name) {
  const m = from.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`, 'm'));
  if (!m) throw new Error(`missing const ${name}`);
  return unescapeJs(m[1]);
}

const PATCHES = [
  ['Reset run dedup state', () => extractExport(fs.readFileSync(path.join(root, 'workflows/n8n/forum-prompt-synthesis.shared.ts'), 'utf8'), 'RESET_RUN_STATIC_JS')],
  ['Fetch RSS headlines', () => extractExport(fs.readFileSync(path.join(root, 'workflows/n8n/forum-prompt-ingest.shared.ts'), 'utf8'), 'FETCH_RSS_DISCOVERY_JS')],
  ['Cluster headlines', () => extractExport(fs.readFileSync(path.join(root, 'workflows/n8n/forum-prompt-ingest.shared.ts'), 'utf8'), 'RSS_CLUSTER_JS')],
  ['Build discovery input', () => extractConst(fs.readFileSync(path.join(root, 'workflows/n8n/forum-research-discovery.workflow.ts'), 'utf8'), 'BUILD_DISCOVERY_INPUT_JS')],
  ['Enrich story articles', () => extractExport(fs.readFileSync(path.join(root, 'workflows/n8n/forum-article-enrich.shared.ts'), 'utf8'), 'ENRICH_STORY_ARTICLES_JS')],
  ['Build deep research input', () => extractExport(fs.readFileSync(path.join(root, 'workflows/n8n/forum-prompt-synthesis.shared.ts'), 'utf8'), 'BUILD_DEEP_RESEARCH_INPUT_JS')],
  ['Build journalist input', () => extractExport(fs.readFileSync(path.join(root, 'workflows/n8n/forum-prompt-synthesis.shared.ts'), 'utf8'), 'BUILD_JOURNALIST_INPUT_JS')],
  ['Build editor input', () => extractExport(fs.readFileSync(path.join(root, 'workflows/n8n/forum-prompt-synthesis.shared.ts'), 'utf8'), 'BUILD_EDITOR_INPUT_JS')],
  ['Finalize prompts', () => extractExport(fs.readFileSync(path.join(root, 'workflows/n8n/forum-prompt-synthesis.shared.ts'), 'utf8'), 'FINALIZE_PROMPTS_JS')],
  ['Prepare saves', () => extractExport(fs.readFileSync(path.join(root, 'workflows/n8n/forum-prompt-synthesis.shared.ts'), 'utf8'), 'PREPARE_SAVES_JS')],
  ['Expand from saved', () => extractExport(fs.readFileSync(path.join(root, 'workflows/n8n/forum-prompt-synthesis.shared.ts'), 'utf8'), 'EXPAND_SAVED_CLUSTER_JS')],
  ['check_duplicate', () => {
    const synthesisSrc = fs.readFileSync(path.join(root, 'workflows/n8n/forum-prompt-synthesis.shared.ts'), 'utf8');
    const parseM = synthesisSrc.match(/const TOOL_INPUT_PARSE_JS = `([\s\S]*?)`;/m);
    const bodyM = synthesisSrc.match(/export const CHECK_DUPLICATE_TOOL_JS = `\$\{TOOL_INPUT_PARSE_JS\}([\s\S]*?)`;/m);
    if (!parseM || !bodyM) throw new Error('CHECK_DUPLICATE_TOOL_JS');
    return unescapeJs(parseM[1] + bodyM[1]);
  }],
];

async function main() {
  loadEnv();
  const key = process.env.N8N_API_KEY;
  if (!key) throw new Error('N8N_API_KEY missing');

  const raw = await fetch(`${N8N_BASE}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': key },
  }).then((r) => r.json());
  const wf = raw.data ?? raw;

  const updated = [];
  for (const [nodeName, getJs] of PATCHES) {
    const n = wf.nodes.find((x) => x.name === nodeName);
    if (!n) continue;
    n.parameters = n.parameters || {};
    n.parameters.jsCode = getJs();
    updated.push(nodeName);
  }

  const put = await fetch(`${N8N_BASE}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: { executionOrder: 'v1' },
    }),
  });
  const body = await put.json();
  if (!put.ok) throw new Error(JSON.stringify(body).slice(0, 800));
  console.log('Patched', updated.length, 'nodes:', updated.join(', '));
  console.log('versionId', body.versionId ?? body.data?.versionId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
