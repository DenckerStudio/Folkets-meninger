#!/usr/bin/env node
/**
 * Deploy document embeddings workflow to n8n (folkets-document-embeddings).
 *
 * Usage:
 *   N8N_API_KEY=... node scripts/deploy-document-embeddings-n8n.mjs
 *   N8N_API_KEY=... node scripts/deploy-document-embeddings-n8n.mjs --test
 *
 * Reads workflow JSON from workflows/n8n/document-embeddings.n8n.json by default.
 * Clones Supabase credential IDs from AI summary workflow GP666Zq84qc19tcE.
 * Sets Ollama embeddings URL from NEXT_PUBLIC_OLLAMA_URL or reference workflow HTTP node.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N8N_BASE = process.env.N8N_API_URL || 'https://n8n.heyklever.app';
const AI_SUMMARY_WORKFLOW_ID = 'GP666Zq84qc19tcE';
const WORKFLOW_NAME = 'Folkets Stemme – dokument embeddings (RAG)';
const WEBHOOK_PATH = 'folkets-document-embeddings';

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

function normalizeOllamaEmbeddingsUrl(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!trimmed) return null;
  return `${trimmed}/api/embeddings`;
}

function findSupabaseCredentialId(nodes) {
  for (const node of nodes) {
    const cred = node?.credentials?.supabaseApi;
    if (cred?.id) {
      return { id: cred.id, name: cred.name || 'Folkets Stemme Self-hosted' };
    }
  }
  return null;
}

function findOllamaHttpUrl(nodes) {
  for (const node of nodes) {
    if (node.type !== 'n8n-nodes-base.httpRequest') continue;
    const url = node?.parameters?.url;
    if (typeof url === 'string' && url.includes('/api/embeddings')) {
      return url;
    }
  }
  return null;
}

function applyCredentials(workflow, supabaseCred, ollamaUrl) {
  const nodes = workflow.nodes.map((node) => {
    const next = { ...node };
    if (supabaseCred && next.type === 'n8n-nodes-base.supabase') {
      next.credentials = {
        supabaseApi: { id: supabaseCred.id, name: supabaseCred.name },
      };
    }
    if (ollamaUrl && next.type === 'n8n-nodes-base.httpRequest' && next.name === 'Ollama embeddings') {
      next.parameters = { ...next.parameters, url: ollamaUrl };
    }
    return next;
  });
  return { ...workflow, nodes };
}

async function n8nFetch(key, pathname, init = {}) {
  const res = await fetch(`${N8N_BASE}${pathname}`, {
    ...init,
    headers: {
      'X-N8N-API-KEY': key,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${pathname}: ${res.status} ${text}`);
  }
  return json?.data ?? json;
}

async function findExistingWorkflowId(key) {
  const list = await n8nFetch(key, '/api/v1/workflows?limit=250');
  const workflows = Array.isArray(list) ? list : list?.workflows || [];
  const match = workflows.find(
    (wf) =>
      wf.name === WORKFLOW_NAME ||
      (wf.nodes || []).some(
        (n) =>
          n.type === 'n8n-nodes-base.webhook' &&
          n.parameters?.path === WEBHOOK_PATH,
      ),
  );
  return match?.id || null;
}

async function testWebhook() {
  const res = await fetch(`${N8N_BASE}/webhook/${WEBHOOK_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stortinget_issue_id: '200329' }),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function main() {
  loadEnv();
  const key = process.env.N8N_API_KEY;
  if (!key) throw new Error('N8N_API_KEY missing (set in environment or .env.local)');

  const inputArg = process.argv.indexOf('--input');
  const defaultPath = path.join(root, 'workflows/n8n/document-embeddings.n8n.json');
  const inputPath = inputArg >= 0 ? process.argv[inputArg + 1] : defaultPath;
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Workflow JSON not found: ${inputPath}`);
  }

  let workflow = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  const reference = await n8nFetch(key, `/api/v1/workflows/${AI_SUMMARY_WORKFLOW_ID}`);
  const supabaseCred =
    findSupabaseCredentialId(reference.nodes || []) ||
    (process.env.N8N_SUPABASE_CREDENTIAL_ID
      ? {
          id: process.env.N8N_SUPABASE_CREDENTIAL_ID,
          name: process.env.N8N_SUPABASE_CREDENTIAL_NAME || 'Folkets Stemme Self-hosted',
        }
      : { id: 'DGPnXfRlXSdJG7RL', name: 'Folkets Stemme Self-hosted' });
  if (!supabaseCred?.id) {
    throw new Error(`Could not find Supabase credential in reference workflow ${AI_SUMMARY_WORKFLOW_ID}`);
  }

  const ollamaUrl =
    normalizeOllamaEmbeddingsUrl(process.env.NEXT_PUBLIC_OLLAMA_URL) ||
    findOllamaHttpUrl(reference.nodes || []);
  if (!ollamaUrl) {
    throw new Error('Could not resolve Ollama embeddings URL (set NEXT_PUBLIC_OLLAMA_URL)');
  }

  workflow = applyCredentials(workflow, supabaseCred, ollamaUrl);

  const existingId = await findExistingWorkflowId(key);
  let workflowId;
  let active;

  const payload = {
    name: WORKFLOW_NAME,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || { executionOrder: 'v1' },
    staticData: workflow.staticData ?? null,
  };

  if (existingId) {
    const updated = await n8nFetch(key, `/api/v1/workflows/${existingId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    workflowId = updated.id || existingId;
  } else {
    const created = await n8nFetch(key, '/api/v1/workflows', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    workflowId = created.id;
  }

  await n8nFetch(key, `/api/v1/workflows/${workflowId}/activate`, { method: 'POST' });
  const activated = await n8nFetch(key, `/api/v1/workflows/${workflowId}`);
  active = Boolean(activated.active);

  const webhookTest = process.argv.includes('--skip-test')
    ? null
    : await testWebhook();

  const result = {
    ok: true,
    workflowId,
    active,
    webhookPath: WEBHOOK_PATH,
    supabaseCredential: supabaseCred,
    ollamaEmbeddingsUrl: ollamaUrl,
    webhookTest,
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
