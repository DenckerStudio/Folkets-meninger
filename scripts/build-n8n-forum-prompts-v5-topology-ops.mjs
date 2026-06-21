#!/usr/bin/env node
/**
 * n8n topology ops for forum prompts v5: Fetch article bodies between Collect and Build agent input.
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
    type: 'removeConnection',
    source: 'Collect all headlines',
    target: 'Build agent input',
  },
  {
    type: 'addNode',
    node: {
      name: 'Fetch article bodies',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [960, 400],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: extract('FETCH_ARTICLE_BODIES_JS'),
      },
    },
  },
  {
    type: 'addConnection',
    source: 'Collect all headlines',
    target: 'Fetch article bodies',
  },
  {
    type: 'addConnection',
    source: 'Fetch article bodies',
    target: 'Build agent input',
  },
];

const outPath = process.argv[2] || '/tmp/n8n-forum-prompts-v5-topology-ops.json';
fs.writeFileSync(
  outPath,
  JSON.stringify({ workflowId: 'MloIdsnX7FozM4dv', operations }, null, 2),
);
console.log('Wrote', outPath, `(${operations.length} operations)`);
