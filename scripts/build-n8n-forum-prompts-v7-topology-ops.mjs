#!/usr/bin/env node
/**
 * n8n topology ops v7: synthesis reads forum_research_clusters (removes RSS ingest from synthesis workflow).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(
  path.join(root, 'workflows/n8n/forum-trending-prompts.workflow.ts'),
  'utf8',
);

function extract(name) {
  const re = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`missing ${name}`);
  return m[1].replace(/\\\\/g, '\\');
}

const DEEP_RESEARCH_SYSTEM = extract('DEEP_RESEARCH_SYSTEM');

const operations = [
  { type: 'removeConnection', source: 'Fetch trusted sources', target: 'Fetch long-running saker' },
  { type: 'removeConnection', source: 'Fetch long-running saker', target: 'Fetch RSS headlines' },
  { type: 'removeConnection', source: 'Fetch RSS headlines', target: 'Collect all headlines' },
  { type: 'removeConnection', source: 'Collect all headlines', target: 'Fetch article bodies' },
  { type: 'removeConnection', source: 'Collect all headlines', target: 'Build agent input' },
  { type: 'removeConnection', source: 'Fetch article bodies', target: 'Build agent input' },
  { type: 'removeConnection', source: 'Build agent input', target: 'Has headlines?' },
  { type: 'removeNode', nodeName: 'Fetch long-running saker' },
  { type: 'removeNode', nodeName: 'Fetch RSS headlines' },
  { type: 'removeNode', nodeName: 'Collect all headlines' },
  {
    type: 'addNode',
    node: {
      name: 'Fetch pending clusters',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [960, 96],
      parameters: { operation: 'executeQuery', query: extract('PENDING_CLUSTERS_SQL') },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Process one cluster',
      type: 'n8n-nodes-base.splitInBatches',
      typeVersion: 3,
      position: [1184, 96],
      parameters: { batchSize: 1 },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Expand cluster',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1408, 96],
      parameters: {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: extract('EXPAND_CLUSTER_JS'),
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Build deep research input',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1856, 96],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: extract('BUILD_DEEP_RESEARCH_INPUT_JS'),
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Deep research (Ollama)',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 3.1,
      position: [2080, 96],
      parameters: {
        promptType: 'define',
        text: '={{ $json.deepResearchText }}',
        hasOutputParser: true,
        options: {
          systemMessage: DEEP_RESEARCH_SYSTEM,
          maxIterations: 2,
          returnIntermediateSteps: false,
          enableStreaming: false,
        },
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Deep research Ollama Chat Model',
      type: '@n8n/n8n-nodes-langchain.lmChatOllama',
      typeVersion: 1,
      position: [2080, 320],
      parameters: {
        model: 'llama3.1:8b',
        options: { think: false, temperature: 0.15, format: 'json', numPredict: 2000, numCtx: 8192 },
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Deep research JSON parser',
      type: '@n8n/n8n-nodes-langchain.outputParserStructured',
      typeVersion: 1.3,
      position: [2304, 320],
      parameters: {
        schemaType: 'fromJson',
        jsonSchemaExample:
          '{"story_title":"Sak","summary":"Oppsummering","shared_facts":["fakta"],"disagreements":["uenighet"],"political_choice":"Valg","poll_angles":["vinkel"],"source_quality":"god","confidence":"high"}',
        autoFix: true,
      },
    },
  },
  { type: 'addConnection', source: 'Fetch trusted sources', target: 'Fetch pending clusters' },
  { type: 'addConnection', source: 'Fetch pending clusters', target: 'Process one cluster' },
  { type: 'addConnection', source: 'Process one cluster', target: 'Expand cluster', branch: 'each batch' },
  { type: 'addConnection', source: 'Expand cluster', target: 'Fetch article bodies' },
  { type: 'addConnection', source: 'Fetch article bodies', target: 'Build deep research input' },
  { type: 'addConnection', source: 'Build deep research input', target: 'Has headlines?' },
  { type: 'addConnection', source: 'Has headlines?', target: 'Deep research (Ollama)', branch: 'true' },
  { type: 'addConnection', source: 'Deep research (Ollama)', target: 'Build agent input' },
  { type: 'addConnection', source: 'Build agent input', target: 'Generate prompts (Ollama)' },
  {
    type: 'addConnection',
    source: 'Deep research (Ollama)',
    target: 'Deep research Ollama Chat Model',
    connectionType: 'ai_languageModel',
  },
  {
    type: 'addConnection',
    source: 'Deep research JSON parser',
    target: 'Deep research (Ollama)',
    connectionType: 'ai_outputParser',
  },
  {
    type: 'addConnection',
    source: 'Deep research Ollama Chat Model',
    target: 'Deep research JSON parser',
    connectionType: 'ai_languageModel',
  },
  { type: 'addConnection', source: 'Save prompt', target: 'Process one cluster', branch: 'loop' },
];

const outPath = process.argv[2] || '/tmp/n8n-v7-topology.json';
fs.writeFileSync(
  outPath,
  JSON.stringify({ workflowId: 'MloIdsnX7FozM4dv', operations }, null, 2),
);
console.log('Wrote', outPath, `(${operations.length} operations)`);
