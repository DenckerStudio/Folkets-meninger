#!/usr/bin/env node
/**
 * Live fixes for v8 synthesis block: Coalesce node, smaller deep-research agent, Ollama ctx, SearXNG cred.
 * Usage: node scripts/patch-forum-v8-live-synthesis.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW_ID = 'mjiQBSdxVv0sAuMu';
const N8N_BASE = process.env.N8N_API_URL || 'https://n8n.heyklever.app';
const SEARX_CRED = { id: 's4sozm3pIpMRVfYD', name: 'SearXNG account' };

function loadEnv() {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
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

function addMainConnection(connections, source, target) {
  if (!connections[source]) connections[source] = { main: [[]] };
  if (!connections[source].main) connections[source].main = [[]];
  const bucket = connections[source].main[0];
  const exists = bucket.some((c) => c.node === target && c.type === 'main');
  if (!exists) bucket.push({ node: target, type: 'main', index: 0 });
}

function removeMainConnection(connections, source, target) {
  const bucket = connections[source]?.main?.[0];
  if (!bucket) return;
  connections[source].main[0] = bucket.filter((c) => !(c.node === target && c.type === 'main'));
}

async function main() {
  loadEnv();
  const key = process.env.N8N_API_KEY;
  if (!key) throw new Error('N8N_API_KEY missing');

  const synthesisSrc = fs.readFileSync(
    path.join(root, 'workflows/n8n/forum-prompt-synthesis.shared.ts'),
    'utf8',
  );
  const coalesceJs = extractExport(synthesisSrc, 'COALESCE_DEEP_RESEARCH_JS');

  const raw = await fetch(`${N8N_BASE}/api/v1/workflows/${WORKFLOW_ID}`, {
    headers: { 'X-N8N-API-KEY': key },
  }).then((r) => r.json());
  const wf = raw.data ?? raw;
  const nodes = [...wf.nodes];
  const connections = structuredClone(wf.connections || {});

  if (!nodes.some((n) => n.name === 'Coalesce deep research')) {
    const buildNode = nodes.find((n) => n.name === 'Build deep research input');
    const pos = buildNode?.position || [4480, 224];
    nodes.push({
      id: randomUUID(),
      name: 'Coalesce deep research',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [pos[0] + 256, pos[1]],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: coalesceJs,
      },
    });
    console.log('Added Coalesce deep research node');
  } else {
    const c = nodes.find((n) => n.name === 'Coalesce deep research');
    c.parameters.jsCode = coalesceJs;
    console.log('Updated Coalesce deep research jsCode');
  }

  removeMainConnection(connections, 'Deep research (Ollama)', 'Build journalist input');
  addMainConnection(connections, 'Deep research (Ollama)', 'Coalesce deep research');
  addMainConnection(connections, 'Coalesce deep research', 'Build journalist input');

  const deepAgent = nodes.find((n) => n.name === 'Deep research (Ollama)');
  if (deepAgent) {
    deepAgent.onError = 'continueRegularOutput';
    deepAgent.alwaysOutputData = true;
    deepAgent.continueOnFail = true;
    deepAgent.parameters = deepAgent.parameters || {};
    deepAgent.parameters.hasOutputParser = false;
    deepAgent.parameters.options = {
      ...(deepAgent.parameters.options || {}),
      maxIterations: 1,
      enableStreaming: false,
    };
  }

  const deepModel = nodes.find((n) => n.name === 'Deep research Ollama Chat Model');
  if (deepModel) {
    deepModel.parameters = deepModel.parameters || {};
    deepModel.parameters.options = {
      think: false,
      temperature: 0.15,
      format: 'json',
      numPredict: 1400,
      numCtx: 16384,
    };
  }

  const searx = nodes.find((n) => n.name === 'searxng_discovery');
  if (searx) {
    searx.parameters = { options: {} };
    searx.credentials = { searXngApi: { ...SEARX_CRED } };
  }

  // Drop structured parser from deep research agent (hasOutputParser=false; avoids extra Ollama calls).
  if (connections['Deep research JSON parser']?.ai_outputParser) {
    delete connections['Deep research JSON parser'];
  }
  const deepModelLinks = connections['Deep research Ollama Chat Model']?.ai_languageModel?.[0] || [];
  connections['Deep research Ollama Chat Model'] = {
    ai_languageModel: [
      deepModelLinks.filter((c) => c.node !== 'Deep research JSON parser'),
    ],
  };

  const put = await fetch(`${N8N_BASE}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: wf.name,
      nodes,
      connections,
      settings: { executionOrder: 'v1', ...(wf.settings?.timezone ? { timezone: wf.settings.timezone } : {}) },
    }),
  });
  const body = await put.json();
  if (!put.ok) throw new Error(JSON.stringify(body).slice(0, 1200));
  console.log('Live synthesis patch OK', body.versionId ?? body.data?.versionId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
