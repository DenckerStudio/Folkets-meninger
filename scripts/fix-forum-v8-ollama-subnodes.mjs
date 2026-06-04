#!/usr/bin/env node
/**
 * Repair live v8 workflow mjiQBSdxVv0sAuMu: SDK subnodes were not exported as n8n nodes.
 * Adds Ollama models, output parsers, SearXNG + check_duplicate tools, and ai_* connections.
 *
 * Usage: node scripts/fix-forum-v8-ollama-subnodes.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW_ID = 'mjiQBSdxVv0sAuMu';
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

function extractExport(from, name) {
  const re = new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const m = from.match(re);
  if (!m) throw new Error(`missing export ${name}`);
  return m[1];
}

function extractCheckDuplicateJs(synthesisSrc) {
  const parseM = synthesisSrc.match(/const TOOL_INPUT_PARSE_JS = `([\s\S]*?)`;/m);
  const bodyM = synthesisSrc.match(
    /export const CHECK_DUPLICATE_TOOL_JS = `\$\{TOOL_INPUT_PARSE_JS\}([\s\S]*?)`;/m,
  );
  if (!parseM || !bodyM) throw new Error('missing CHECK_DUPLICATE_TOOL_JS block');
  return parseM[1] + bodyM[1];
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
  if (!res.ok) throw new Error(`n8n ${res.status}: ${text.slice(0, 800)}`);
  return body;
}

function hasNode(nodes, name) {
  return nodes.some((n) => n.name === name);
}

function addAiConnection(connections, source, target, connectionType) {
  if (!connections[source]) connections[source] = {};
  if (!connections[source][connectionType]) connections[source][connectionType] = [[]];
  const bucket = connections[source][connectionType][0];
  const exists = bucket.some((c) => c.node === target && c.type === connectionType);
  if (!exists) {
    bucket.push({ node: target, type: connectionType, index: 0 });
  }
}

function makeOllamaNode(name, position, params) {
  return {
    id: randomUUID(),
    name,
    type: '@n8n/n8n-nodes-langchain.lmChatOllama',
    typeVersion: 1,
    position,
    parameters: params,
    credentials: { ollamaApi: { ...OLLAMA_CRED } },
  };
}

function makeParserNode(name, position, jsonSchemaExample) {
  return {
    id: randomUUID(),
    name,
    type: '@n8n/n8n-nodes-langchain.outputParserStructured',
    typeVersion: 1.3,
    position,
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample,
      autoFix: true,
    },
  };
}

async function main() {
  loadEnv();
  const dryRun = process.argv.includes('--dry-run');
  const synthesisSrc = fs.readFileSync(
    path.join(root, 'workflows/n8n/forum-prompt-synthesis.shared.ts'),
    'utf8',
  );
  const checkDuplicateJs = extractCheckDuplicateJs(synthesisSrc);

  const res = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`);
  const wf = res.data ?? res;
  const nodes = [...wf.nodes];
  const connections = structuredClone(wf.connections || {});

  const added = [];

  const specs = [
    {
      name: 'Discovery Ollama Chat Model',
      factory: () =>
        makeOllamaNode('Discovery Ollama Chat Model', [1792, 320], {
          model: 'llama3.1:8b',
          options: { think: false, temperature: 0.2, format: 'json', numPredict: 1600, numCtx: 8192 },
        }),
      links: [
        ['Discovery Ollama Chat Model', 'Discover stories (Ollama)', 'ai_languageModel'],
        ['Discovery JSON parser', 'Discover stories (Ollama)', 'ai_outputParser'],
        ['Discovery Ollama Chat Model', 'Discovery JSON parser', 'ai_languageModel'],
        ['searxng_discovery', 'Discover stories (Ollama)', 'ai_tool'],
      ],
      extraNodes: [
        () =>
          makeParserNode(
            'Discovery JSON parser',
            [2016, 320],
            '{"stories":[{"cluster_id":0,"title":"Kort sak","why_interesting":"Politisk debatt","priority":1,"topic_tags":["politikk"],"article_indices":[0,1,2]}]}',
          ),
        () => ({
          id: randomUUID(),
          name: 'searxng_discovery',
          type: '@n8n/n8n-nodes-langchain.toolSearXng',
          typeVersion: 1,
          position: [1792, 480],
          parameters: {
            options: { numResults: 8, language: 'nb', safesearch: 0 },
          },
          credentials: { searXngApi: { ...SEARX_CRED } },
        }),
      ],
      agent: 'Discover stories (Ollama)',
      hasOutputParser: true,
    },
    {
      name: 'Deep research Ollama Chat Model',
      factory: () =>
        makeOllamaNode('Deep research Ollama Chat Model', [4608, 224], {
          model: 'llama3.1:8b',
          options: { think: false, temperature: 0.15, format: 'json', numPredict: 2000, numCtx: 8192 },
        }),
      links: [
        ['Deep research Ollama Chat Model', 'Deep research (Ollama)', 'ai_languageModel'],
        ['Deep research JSON parser', 'Deep research (Ollama)', 'ai_outputParser'],
        ['Deep research Ollama Chat Model', 'Deep research JSON parser', 'ai_languageModel'],
      ],
      extraNodes: [
        () =>
          makeParserNode(
            'Deep research JSON parser',
            [4832, 224],
            '{"story_title":"Sak","summary":"Kort","shared_facts":["fakta"],"disagreements":["uenighet"],"political_choice":"Valg","poll_angles":["vinkel"],"source_quality":"god","confidence":"high"}',
          ),
      ],
      agent: 'Deep research (Ollama)',
      hasOutputParser: true,
    },
    {
      name: 'Synthesis Ollama Chat Model',
      factory: () =>
        makeOllamaNode('Synthesis Ollama Chat Model', [5184, 224], {
          model: 'llama3.1:8b',
          options: { think: false, temperature: 0.15, format: 'default', numPredict: 2400, numCtx: 8192 },
        }),
      links: [
        ['Synthesis Ollama Chat Model', 'Journalist (Ollama)', 'ai_languageModel'],
        ['check_duplicate', 'Journalist (Ollama)', 'ai_tool'],
      ],
      extraNodes: [
        () => ({
          id: randomUUID(),
          name: 'check_duplicate',
          type: '@n8n/n8n-nodes-langchain.toolCode',
          typeVersion: 1.3,
          position: [5184, 480],
          parameters: {
            description:
              'Check duplicate forum poll questions. Call with JSON: {"question":"Støtter du ...?"}. Returns DUPLICATE or OK.',
            language: 'javaScript',
            specifyInputSchema: true,
            schemaType: 'fromJson',
            jsonSchemaExample: '{"question":"Støtter du nasjonalt forbud mot lasere?"}',
            jsCode: checkDuplicateJs,
          },
        }),
      ],
      agent: 'Journalist (Ollama)',
      hasOutputParser: false,
    },
    {
      name: 'Editor Ollama Chat Model',
      factory: () =>
        makeOllamaNode('Editor Ollama Chat Model', [5760, 224], {
          model: 'llama3.1:8b',
          options: { think: false, temperature: 0.1, format: 'json', numPredict: 1400, numCtx: 8192 },
        }),
      links: [
        ['Editor Ollama Chat Model', 'Editor (Ollama)', 'ai_languageModel'],
        ['Editor JSON parser', 'Editor (Ollama)', 'ai_outputParser'],
        ['Editor Ollama Chat Model', 'Editor JSON parser', 'ai_languageModel'],
      ],
      extraNodes: [
        () =>
          makeParserNode(
            'Editor JSON parser',
            [5984, 224],
            '{"approved_prompts":[{"question":"Støtter du X?","novelty_explanation":"…","source_indices":[0,1,2],"topic_tags":["politikk"],"sensitivity":"low","status":"active"}],"rejected":[]}',
          ),
      ],
      agent: 'Editor (Ollama)',
      hasOutputParser: true,
    },
  ];

  for (const spec of specs) {
    if (!hasNode(nodes, spec.name)) {
      nodes.push(spec.factory());
      added.push(spec.name);
    }
    for (const extra of spec.extraNodes || []) {
      const n = extra();
      if (!hasNode(nodes, n.name)) {
        nodes.push(n);
        added.push(n.name);
      }
    }
    for (const [src, tgt, ctype] of spec.links) {
      addAiConnection(connections, src, tgt, ctype);
    }
    const agent = nodes.find((n) => n.name === spec.agent);
    if (agent) {
      agent.parameters = agent.parameters || {};
      if (spec.hasOutputParser) agent.parameters.hasOutputParser = true;
    }
  }

  // Ensure postgres nodes still have creds (unchanged)
  console.log('Added nodes:', added.length ? added.join(', ') : '(none — already present)');
  console.log('Total nodes:', nodes.length);

  const ollamaNodes = nodes.filter((n) => n.type?.includes('lmChatOllama'));
  for (const n of ollamaNodes) {
    n.credentials = { ollamaApi: { ...OLLAMA_CRED } };
  }

  if (dryRun) {
    console.log('Dry run — no PUT');
    return;
  }

  const settings = { executionOrder: 'v1' };
  if (wf.settings?.timezone) settings.timezone = wf.settings.timezone;

  const payload = {
    name: wf.name,
    nodes,
    connections,
    settings,
  };

  const updated = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  console.log('Updated:', updated.id || WORKFLOW_ID, updated.versionId || updated.data?.versionId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
