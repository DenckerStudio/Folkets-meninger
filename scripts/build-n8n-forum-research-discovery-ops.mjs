#!/usr/bin/env node
/**
 * Build n8n update_workflow payload from forum-research-discovery.workflow.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(
  path.join(root, 'workflows/n8n/forum-research-discovery.workflow.ts'),
  'utf8',
);
const sharedSrc = fs.readFileSync(
  path.join(root, 'workflows/n8n/forum-prompt-ingest.shared.ts'),
  'utf8',
);

function extract(from, name) {
  const re = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const m = from.match(re);
  if (!m) throw new Error(`missing ${name}`);
  return m[1].replace(/\\\\/g, '\\');
}

function extractConst(from, name) {
  const re = new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const m = from.match(re);
  if (!m) throw new Error(`missing ${name}`);
  return m[1];
}

const operations = [
  {
    type: 'setNodeParameter',
    nodeName: 'Discover stories (Ollama)',
    path: '/options/systemMessage',
    value: extract(src, 'DISCOVERY_SYSTEM'),
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Fetch discovery context',
    parameters: { operation: 'executeQuery', query: extractConst(sharedSrc, 'DISCOVERY_CONTEXT_SQL') },
    replace: true,
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Fetch RSS headlines',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: extractConst(sharedSrc, 'FETCH_RSS_DISCOVERY_JS'),
    },
    replace: true,
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Collect headlines',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: extractConst(sharedSrc, 'COLLECT_HEADLINES_DISCOVERY_JS'),
    },
    replace: true,
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Build discovery input',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: extract(src, 'BUILD_DISCOVERY_INPUT_JS'),
    },
    replace: true,
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Prepare cluster saves',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: extract(src, 'PREPARE_CLUSTER_SAVES_JS'),
    },
    replace: true,
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Expand article saves',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: extract(src, 'EXPAND_ARTICLE_SAVES_JS'),
    },
    replace: true,
  },
];

const out = process.argv[2] || '/tmp/n8n-forum-research-discovery-ops.json';
fs.writeFileSync(out, JSON.stringify({ operations }, null, 2));
console.log('Wrote', out, 'with', operations.length, 'operations');
