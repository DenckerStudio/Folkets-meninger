#!/usr/bin/env node
/**
 * Deploy forum v13 sak-RAG prompt generator to n8n.
 *
 * Usage:
 *   N8N_API_KEY=... node scripts/deploy-forum-v13-sak-prompt-generator.mjs
 *   N8N_API_KEY=... node scripts/deploy-forum-v13-sak-prompt-generator.mjs --test
 *
 * Exports fresh workflow JSON from SDK source, applies Postgres/Ollama credentials,
 * creates or updates workflow, activates, optional webhook smoke test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N8N_BASE = process.env.N8N_API_URL || 'https://n8n.heyklever.app';
const AI_SUMMARY_WORKFLOW_ID = 'GP666Zq84qc19tcE';
const PROMPT_GENERATOR_WORKFLOW_ID = 'vOP2zPflfT0yBvDQ';
const WORKFLOW_NAME = 'Folkets Stemme – Forum Stortinget-sak RAG prompt generator (v13)';
const WEBHOOK_PATH = 'folkets-forum-sak-prompt-generator';

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
  if (trimmed.endsWith('/api/embeddings')) return trimmed;
  return `${trimmed}/api/embeddings`;
}

function findPostgresCredentialId(nodes) {
  for (const node of nodes) {
    const cred = node?.credentials?.postgres;
    if (cred?.id && !String(cred.id).includes('CREDENTIAL')) {
      return { id: cred.id, name: cred.name || 'Supabase Postgres Folkets' };
    }
  }
  return null;
}

function findOllamaApiCredential(nodes) {
  for (const node of nodes) {
    const cred = node?.credentials?.ollamaApi;
    if (cred?.id) return { id: cred.id, name: cred.name || 'Ollama account' };
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

function exportWorkflowJson(outPath) {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs';
    import { pathToFileURL } from 'node:url';
    const mod = await import(pathToFileURL('${path.join(root, 'workflows/n8n/forum-sak-prompt-generator.workflow.ts').replace(/\\/g, '/')}').href);
    const json = mod.default.toJSON();
    fs.mkdirSync('${path.dirname(outPath).replace(/\\/g, '/')}', { recursive: true });
    fs.writeFileSync('${outPath.replace(/\\/g, '/')}', JSON.stringify(json, null, 2));
  `], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '--import tsx' },
  });
  if (r.status !== 0) {
    const fallback = spawnSync('npx', ['tsx', path.join(root, 'scripts/export-forum-sak-prompt-workflow-json.mjs'), outPath], {
      cwd: root,
      encoding: 'utf8',
    });
    if (fallback.status !== 0) {
      console.error(r.stderr || r.stdout || fallback.stderr);
      process.exit(1);
    }
  }
}

function flattenLangchainSubnodes(workflow) {
  const nodes = workflow.nodes.map((node) => ({ ...node }));
  const connections = JSON.parse(JSON.stringify(workflow.connections || {}));

  for (const node of nodes) {
    const subnodes = node.parameters?.subnodes;
    if (!subnodes || node.type !== '@n8n/n8n-nodes-langchain.agent') continue;

    const agentPos = node.position || [1500, 300];

    if (subnodes.model) {
      const modelDef = subnodes.model;
      const modelName = modelDef.config?.name || modelDef.name || 'Sak prompt Ollama Chat Model';
      const modelNode = {
        id: modelDef.id || `model-${node.id}`,
        name: modelName,
        type: modelDef.type || '@n8n/n8n-nodes-langchain.lmChatOllama',
        typeVersion: Number(modelDef.version) || 1,
        position: [agentPos[0] - 180, agentPos[1] + 220],
        parameters: modelDef.config?.parameters || {},
        credentials: modelDef.config?.credentials || {},
      };
      if (!nodes.some((n) => n.name === modelName)) nodes.push(modelNode);
      connections[modelName] = {
        ai_languageModel: [[{ node: node.name, type: 'ai_languageModel', index: 0 }]],
      };
    }

    if (subnodes.outputParser && node.parameters?.hasOutputParser) {
      const parserDef = subnodes.outputParser;
      const parserName = parserDef.config?.name || parserDef.name || 'Sak prompt JSON parser';
      const parserNode = {
        id: parserDef.id || `parser-${node.id}`,
        name: parserName,
        type: parserDef.type || '@n8n/n8n-nodes-langchain.outputParserStructured',
        typeVersion: Number(parserDef.version) || 1.3,
        position: [agentPos[0] + 180, agentPos[1] + 220],
        parameters: parserDef.config?.parameters || {},
        onError: parserDef.config?.onError || 'continueRegularOutput',
      };
      if (!nodes.some((n) => n.name === parserName)) nodes.push(parserNode);
      connections[parserName] = {
        ai_outputParser: [[{ node: node.name, type: 'ai_outputParser', index: 0 }]],
      };

      const parserModelDef = parserDef.config?.subnodes?.model;
      if (parserModelDef) {
        const parserModelName =
          parserModelDef.config?.name || parserModelDef.name || 'Sak prompt parser Ollama';
        const parserModelNode = {
          id: parserModelDef.id || `parser-model-${node.id}`,
          name: parserModelName,
          type: parserModelDef.type || '@n8n/n8n-nodes-langchain.lmChatOllama',
          typeVersion: Number(parserModelDef.version) || 1,
          position: [agentPos[0] + 180, agentPos[1] + 420],
          parameters: parserModelDef.config?.parameters || {},
          credentials: parserModelDef.config?.credentials || {},
        };
        if (!nodes.some((n) => n.name === parserModelName)) nodes.push(parserModelNode);
        connections[parserModelName] = {
          ai_languageModel: [[{ node: parserName, type: 'ai_languageModel', index: 0 }]],
        };
      }
    }

    const { subnodes: _removed, ...cleanParams } = node.parameters;
    node.parameters = cleanParams;
  }

  return { ...workflow, nodes, connections };
}

function applyCredentials(workflow, { postgresCred, ollamaApiCred, ollamaUrl }) {
  const nodes = workflow.nodes.map((node) => {
    const next = { ...node };
    if (postgresCred && next.type === 'n8n-nodes-base.postgres') {
      next.credentials = {
        postgres: { id: postgresCred.id, name: postgresCred.name },
      };
    }
    if (ollamaApiCred && next.type === '@n8n/n8n-nodes-langchain.lmChatOllama') {
      next.credentials = {
        ollamaApi: { id: ollamaApiCred.id, name: ollamaApiCred.name },
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
        (n) => n.type === 'n8n-nodes-base.webhook' && n.parameters?.path === WEBHOOK_PATH,
      ),
  );
  return match?.id || null;
}

async function testWebhook() {
  const res = await fetch(`${N8N_BASE}/webhook/${WEBHOOK_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function main() {
  loadEnv();
  const key = process.env.N8N_API_KEY;
  if (!key) throw new Error('N8N_API_KEY missing');

  const jsonPath = path.join(root, 'workflows/n8n/forum-sak-prompt-generator.n8n.json');
  exportWorkflowJson(jsonPath);
  let workflow = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const [aiSummary, promptGen] = await Promise.all([
    n8nFetch(key, `/api/v1/workflows/${AI_SUMMARY_WORKFLOW_ID}`),
    n8nFetch(key, `/api/v1/workflows/${PROMPT_GENERATOR_WORKFLOW_ID}`),
  ]);

  const postgresCred =
    findPostgresCredentialId(promptGen.nodes || []) ||
    findPostgresCredentialId(aiSummary.nodes || []);
  const ollamaApiCred =
    findOllamaApiCredential(promptGen.nodes || []) ||
    findOllamaApiCredential(aiSummary.nodes || []);

  if (!postgresCred) {
    throw new Error('Could not resolve Postgres credential from reference workflows');
  }
  if (!ollamaApiCred) {
    throw new Error('Could not resolve Ollama API credential from reference workflows');
  }

  const ollamaUrl =
    normalizeOllamaEmbeddingsUrl(process.env.NEXT_PUBLIC_OLLAMA_URL) ||
    findOllamaHttpUrl(aiSummary.nodes || []);
  if (!ollamaUrl) {
    throw new Error('Could not resolve Ollama embeddings URL (set NEXT_PUBLIC_OLLAMA_URL)');
  }

  workflow = flattenLangchainSubnodes(workflow);
  workflow = applyCredentials(workflow, { postgresCred, ollamaApiCred, ollamaUrl });
  fs.writeFileSync(jsonPath, JSON.stringify(workflow, null, 2));

  const existingId = await findExistingWorkflowId(key);
  const payload = {
    name: WORKFLOW_NAME,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || { executionOrder: 'v1' },
    staticData: workflow.staticData ?? null,
  };

  let workflowId;
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
  const webhookTest = process.argv.includes('--skip-test') ? null : await testWebhook();

  const result = {
    ok: true,
    workflowId,
    active: Boolean(activated.active),
    webhookUrl: `${N8N_BASE}/webhook/${WEBHOOK_PATH}`,
    postgresCredential: postgresCred,
    ollamaApiCredential: ollamaApiCred,
    ollamaEmbeddingsUrl: ollamaUrl,
    webhookTest,
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
