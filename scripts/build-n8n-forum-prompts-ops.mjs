#!/usr/bin/env node
/**
 * @deprecated v8 — synthesis lives in forum-research-discovery.workflow.ts
 * Use: node scripts/build-n8n-forum-research-discovery-ops.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const trendingPath = path.join(root, 'workflows/n8n/forum-trending-prompts.workflow.ts');
if (!fs.existsSync(trendingPath)) {
  console.error(
    'forum-trending-prompts.workflow.ts removed in v8. Use build-n8n-forum-research-discovery-ops.mjs',
  );
  process.exit(1);
}
const src = fs.readFileSync(trendingPath, 'utf8');

function extract(name) {
  const re = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`missing ${name}`);
  return m[1].replace(/\\\\/g, '\\');
}

const operations = [
  {
    type: 'setNodeParameter',
    nodeName: 'Deep research (Ollama)',
    path: '/options/systemMessage',
    value: extract('DEEP_RESEARCH_SYSTEM'),
  },
  {
    type: 'setNodeParameter',
    nodeName: 'Generate prompts (Ollama)',
    path: '/options/systemMessage',
    value: extract('PROMPT_SYSTEM'),
  },
  {
    type: 'setNodeParameter',
    nodeName: 'Moderate prompts (Ollama)',
    path: '/options/systemMessage',
    value: extract('MODERATION_SYSTEM'),
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Fetch pending clusters',
    parameters: { operation: 'executeQuery', query: extract('PENDING_CLUSTERS_SQL') },
    replace: true,
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Expand cluster',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: extract('EXPAND_CLUSTER_JS'),
    },
    replace: true,
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Fetch article bodies',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: extract('FETCH_ARTICLE_BODIES_JS'),
    },
    replace: true,
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Build deep research input',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: extract('BUILD_DEEP_RESEARCH_INPUT_JS'),
    },
    replace: true,
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Build agent input',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: extract('BUILD_AGENT_INPUT_JS'),
    },
    replace: true,
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Build moderation input',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: extract('BUILD_MODERATION_INPUT_JS'),
    },
    replace: true,
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Prepare saves',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: extract('PREPARE_SAVES_JS'),
    },
    replace: true,
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Fetch existing prompts',
    parameters: {
      operation: 'executeQuery',
      query: extract('EXISTING_PROMPTS_SQL'),
    },
    replace: true,
  },
  {
    type: 'setNodeParameter',
    nodeName: 'Generate prompts (Ollama)',
    path: '/options/maxIterations',
    value: 8,
  },
];

const outPath = process.argv[2] || '/tmp/n8n-forum-prompts-ops.json';
fs.writeFileSync(
  outPath,
  JSON.stringify({ workflowId: 'MloIdsnX7FozM4dv', operations }, null, 2),
);
console.log('Wrote', outPath, `(${operations.length} operations)`);
