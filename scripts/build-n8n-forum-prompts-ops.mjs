#!/usr/bin/env node
/**
 * Build n8n update_workflow payload from forum-trending-prompts.workflow.ts
 * Unescapes template-literal backslashes so code runs correctly in n8n Code nodes.
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

const operations = [
  {
    type: 'setNodeParameter',
    nodeName: 'Generate prompts (Ollama)',
    path: '/options/systemMessage',
    value: extract('PROMPT_SYSTEM'),
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Fetch RSS headlines',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: extract('FETCH_RSS_JS'),
    },
    replace: true,
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Collect all headlines',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: extract('COLLECT_HEADLINES_JS'),
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
    nodeName: 'Moderation + route',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: extract('MODERATION_ROUTE_JS'),
    },
    replace: true,
  },
];

const outPath = process.argv[2] || '/tmp/n8n-forum-prompts-ops.json';
fs.writeFileSync(
  outPath,
  JSON.stringify({ workflowId: 'MloIdsnX7FozM4dv', operations }, null, 2),
);
console.log('Wrote', outPath, `(${operations.length} operations)`);
