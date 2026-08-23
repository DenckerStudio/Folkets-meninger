#!/usr/bin/env node
/**
 * Deploy Folkets n8n workflows via the instance-level MCP HTTP API.
 *
 * Requires:
 *   N8N_MCP_TOKEN  — Bearer token from n8n Settings → Instance-level MCP → API key
 *   N8N_MCP_URL    — default https://n8n.heyklever.app/mcp-server/http
 *
 * Usage:
 *   N8N_MCP_TOKEN=... node scripts/deploy-n8n-workflows-mcp.mjs
 *   N8N_MCP_TOKEN=... node scripts/deploy-n8n-workflows-mcp.mjs --workflow document-embeddings
 *   N8N_MCP_TOKEN=... node scripts/deploy-n8n-workflows-mcp.mjs --publish
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MCP_URL = (process.env.N8N_MCP_URL || 'https://n8n.heyklever.app/mcp-server/http').replace(/\/$/, '');

const WORKFLOWS = {
  'document-embeddings': {
    workflowId: 'IkedEmJEJFqj7ZnM',
    tsFile: 'workflows/n8n/document-embeddings.workflow.ts',
    name: 'Folkets Stemme – dokument embeddings (RAG)',
  },
  'ai-summary-backfill': {
    workflowId: 'GP666Zq84qc19tcE',
    tsFile: 'workflows/n8n/ai-summary-backfill.workflow.ts',
    name: 'Folkets Stemme – AI-sammendrag backfill',
  },
};

let rpcId = 1;

async function mcpCall(token, method, params = {}) {
  const body = {
    jsonrpc: '2.0',
    id: rpcId++,
    method,
    params,
  };

  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  const line = text
    .split('\n')
    .map((row) => row.trim())
    .find((row) => row.startsWith('{'));

  const json = line ? JSON.parse(line) : JSON.parse(text);
  if (json.error) {
    throw new Error(`MCP ${method}: ${JSON.stringify(json.error)}`);
  }
  return json.result;
}

async function mcpTool(token, name, args) {
  const result = await mcpCall(token, 'tools/call', {
    name,
    arguments: args,
  });

  const text = result?.content?.find((part) => part.type === 'text')?.text;
  if (!text) {
    return result;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function readWorkflowCode(tsRel) {
  const tsPath = path.join(root, tsRel);
  if (!fs.existsSync(tsPath)) {
    throw new Error(`Workflow source not found: ${tsPath}`);
  }
  return fs.readFileSync(tsPath, 'utf8');
}

function buildReplaceWorkflowOperations(exported) {
  const operations = [];

  for (const node of exported.nodes) {
    operations.push({
      operation: 'addNode',
      node: {
        id: node.id,
        name: node.name,
        type: node.type,
        typeVersion: node.typeVersion,
        position: node.position,
        parameters: node.parameters,
        credentials: node.credentials,
        disabled: node.disabled,
        onError: node.onError,
      },
    });
  }

  for (const [sourceName, outputs] of Object.entries(exported.connections || {})) {
    for (const outputSets of outputs.main || []) {
      for (const target of outputSets) {
        operations.push({
          operation: 'addConnection',
          source: sourceName,
          target: target.node,
          sourceIndex: target.index ?? 0,
          targetIndex: target.index ?? 0,
        });
      }
    }
  }

  return operations;
}

async function deployWorkflow(token, key, { publish }) {
  const spec = WORKFLOWS[key];
  const code = await readWorkflowCode(spec.tsFile);

  const validation = await mcpTool(token, 'validate_workflow', { code });
  if (!validation?.valid) {
    throw new Error(`validate_workflow failed for ${key}: ${JSON.stringify(validation)}`);
  }

  const mod = await import(pathToFileURL(path.join(root, spec.tsFile)).href);
  const exported = mod.default.toJSON();

  // Prefer partial update when workflow already exists.
  const removeNodes = (await mcpTool(token, 'get_workflow_details', {
    workflowId: spec.workflowId,
  }))?.workflow?.nodes?.map((node) => ({
    operation: 'removeNode',
    nodeName: node.name,
  })) ?? [];

  const addNodes = buildReplaceWorkflowOperations(exported);

  const update = await mcpTool(token, 'update_workflow', {
    workflowId: spec.workflowId,
    operations: [
      ...removeNodes,
      ...addNodes,
      {
        operation: 'setWorkflowMetadata',
        name: spec.name,
      },
    ],
  });

  if (update?.error) {
    throw new Error(`update_workflow failed for ${key}: ${update.error}`);
  }

  let published = null;
  if (publish) {
    published = await mcpTool(token, 'publish_workflow', {
      workflowId: spec.workflowId,
    });
  }

  return {
    key,
    workflowId: spec.workflowId,
    validation,
    update,
    published,
  };
}

async function main() {
  const token = process.env.N8N_MCP_TOKEN?.trim();
  if (!token) {
    throw new Error(
      'N8N_MCP_TOKEN missing. Generate it in n8n → Settings → Instance-level MCP → API key.',
    );
  }

  await mcpCall(token, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'folkets-deploy-script', version: '1.0.0' },
  });

  const only = process.argv.find((arg) => arg.startsWith('--workflow='))?.split('=')[1]
    || (process.argv.includes('--workflow') ? process.argv[process.argv.indexOf('--workflow') + 1] : null);

  const keys = only ? [only] : Object.keys(WORKFLOWS);
  const publish = process.argv.includes('--publish');
  const results = [];

  for (const key of keys) {
    if (!WORKFLOWS[key]) {
      throw new Error(`Unknown workflow key: ${key}`);
    }
    results.push(await deployWorkflow(token, key, { publish }));
  }

  console.log(JSON.stringify({ ok: true, mcpUrl: MCP_URL, results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
