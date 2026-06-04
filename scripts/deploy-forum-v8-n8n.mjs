#!/usr/bin/env node
/**
 * Deploy Forum Reels v8 to live workflow mjiQBSdxVv0sAuMu via n8n REST API.
 * Prerequisite: temp workflow created from bundled SDK (create_workflow_from_code).
 *
 * Usage:
 *   node scripts/bundle-forum-research-discovery-workflow.mjs /tmp/forum-research-discovery-bundled.ts
 *   node scripts/deploy-forum-v8-n8n.mjs --temp-workflow-id=<id>
 *   node scripts/deploy-forum-v8-n8n.mjs --temp-workflow-id=<id> --archive-synthesis
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE_ID = 'mjiQBSdxVv0sAuMu';
const SYNTHESIS_ID = 'MloIdsnX7FozM4dv';
const N8N_BASE = process.env.N8N_API_URL || 'https://n8n.heyklever.app';
const OLLAMA_CRED = { id: 'BvoHZHzwItBe19ph', name: 'Ollama account' };
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

async function n8nFetch(apiPath, opts = {}) {
  const apiKey = process.env.N8N_API_KEY;
  if (!apiKey) throw new Error('Set N8N_API_KEY in .env.local');
  const res = await fetch(`${N8N_BASE}${apiPath}`, {
    ...opts,
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`n8n ${res.status} ${apiPath}: ${JSON.stringify(body).slice(0, 800)}`);
  }
  return body;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let tempId = '';
  let archiveSynthesis = false;
  let deleteTemp = true;
  for (const a of args) {
    if (a.startsWith('--temp-workflow-id=')) tempId = a.split('=')[1];
    if (a === '--archive-synthesis') archiveSynthesis = true;
    if (a === '--keep-temp') deleteTemp = false;
  }
  if (!tempId) throw new Error('Pass --temp-workflow-id=<id> from create_workflow_from_code');
  return { tempId, archiveSynthesis, deleteTemp };
}

function credByName(nodes, name) {
  const n = nodes.find((x) => x.name === name);
  return n?.credentials || null;
}

function firstCredByType(nodes, typeKey) {
  for (const n of nodes) {
    if (n.credentials?.[typeKey]) return n.credentials[typeKey];
  }
  return null;
}

function mergeCredentials(newNodes, oldNodes) {
  const oldByName = new Map(oldNodes.map((n) => [n.name, n]));
  const postgresCred = firstCredByType(oldNodes, 'postgres');
  const ollamaCred = firstCredByType(oldNodes, 'ollamaApi');
  const searxCred = firstCredByType(oldNodes, 'searXngApi');

  for (const node of newNodes) {
    const old = oldByName.get(node.name);
    if (old?.credentials) {
      node.credentials = { ...old.credentials };
      continue;
    }
    if (node.type?.includes('postgres') && postgresCred) {
      node.credentials = { postgres: { ...postgresCred } };
    }
    if (node.type?.includes('lmChatOllama') && ollamaCred) {
      node.credentials = { ollamaApi: { ...ollamaCred } };
    }
    if (node.type?.includes('toolSearXng') && searxCred) {
      node.credentials = { searXngApi: { ...searxCred } };
    }
  }

  const webhookOld = oldByName.get('Webhook manual');
  const webhookNew = newNodes.find((n) => n.name === 'Webhook manual');
  if (webhookOld?.webhookId && webhookNew) {
    webhookNew.webhookId = webhookOld.webhookId;
    webhookNew.id = webhookOld.id;
  }
  const hourlyOld = oldByName.get('Hourly 00');
  const hourlyNew = newNodes.find((n) => n.name === 'Hourly 00');
  if (hourlyOld?.id && hourlyNew) hourlyNew.id = hourlyOld.id;
}

function patchAgentSubnodeCredentials(nodes) {
  const agentNames = [
    'Discover stories (Ollama)',
    'Deep research (Ollama)',
    'Journalist (Ollama)',
    'Editor (Ollama)',
  ];
  const setOllama = (target) => {
    if (!target) return;
    if (target.config?.credentials) target.config.credentials.ollamaApi = { ...OLLAMA_CRED };
    if (target.credentials) target.credentials.ollamaApi = { ...OLLAMA_CRED };
  };
  for (const node of nodes) {
    if (!agentNames.includes(node.name)) continue;
    const sub = node.parameters?.subnodes;
    if (!sub) continue;
    setOllama(sub.model);
    setOllama(sub.outputParser?.subnodes?.model);
    setOllama(sub.outputParser?.model);
    if (Array.isArray(sub.tools)) {
      for (const t of sub.tools) {
        if (t?.config?.name === 'searxng_discovery' || t?.type?.includes('SearXng')) {
          t.config.credentials = { searXngApi: { ...SEARX_CRED } };
        }
      }
    }
  }
}

async function main() {
  loadEnv();
  const { tempId, archiveSynthesis, deleteTemp } = parseArgs();

  const [live, temp] = await Promise.all([
    n8nFetch(`/api/v1/workflows/${LIVE_ID}`),
    n8nFetch(`/api/v1/workflows/${tempId}`),
  ]);

  const newNodes = temp.nodes || [];
  const newConnections = temp.connections || {};
  mergeCredentials(newNodes, live.nodes || []);
  patchAgentSubnodeCredentials(newNodes);

  const payload = {
    name: 'Folkets Stemme – Forum research discovery (v8)',
    nodes: newNodes,
    connections: newConnections,
    settings: {
      executionOrder: live.settings?.executionOrder || 'v1',
    },
  };

  const put = await n8nFetch(`/api/v1/workflows/${LIVE_ID}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  console.log('PUT live workflow OK:', put.id || LIVE_ID, 'nodes:', put.nodes?.length);

  const fix = spawnSync(process.execPath, [path.join(root, 'scripts/fix-forum-v8-ollama-subnodes.mjs')], {
    stdio: 'inherit',
    cwd: root,
  });
  if (fix.status !== 0) {
    throw new Error('fix-forum-v8-ollama-subnodes.mjs failed — agents may lack Ollama models');
  }

  if (deleteTemp) {
    try {
      await n8nFetch(`/api/v1/workflows/${tempId}`, { method: 'DELETE' });
      console.log('Deleted temp workflow', tempId);
    } catch (e) {
      console.warn('Could not delete temp workflow:', e.message);
    }
  }

  if (archiveSynthesis) {
    try {
      await n8nFetch(`/api/v1/workflows/${SYNTHESIS_ID}/archive`, { method: 'POST' });
      console.log('Archived synthesis workflow', SYNTHESIS_ID);
    } catch (e) {
      console.warn('Archive synthesis failed (try MCP archive_workflow):', e.message);
    }
  }

  console.log('Webhook: POST', `${N8N_BASE}/webhook/folkets-forum-research-discovery`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
