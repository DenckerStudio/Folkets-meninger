#!/usr/bin/env node
/**
 * n8n topology ops for forum prompts v4: trusted sources node, remove Has SQL?, wire moderation → save.
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
    source: 'Moderation + route',
    target: 'Has SQL?',
  },
  {
    type: 'removeConnection',
    source: 'Has SQL?',
    target: 'Save prompt',
  },
  { type: 'removeNode', nodeName: 'Has SQL?' },
  {
    type: 'addConnection',
    source: 'Moderation + route',
    target: 'Save prompt',
  },
  {
    type: 'removeConnection',
    source: 'Fetch existing prompts',
    target: 'Fetch long-running saker',
  },
  {
    type: 'addNode',
    node: {
      name: 'Fetch trusted sources',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [480, 320],
      parameters: {
        operation: 'executeQuery',
        query: extract('TRUSTED_SOURCES_SQL'),
        options: { queryReplacement: '' },
      },
      credentials: { postgres: { id: '', name: 'Fokets Meninger' } },
    },
  },
  {
    type: 'addConnection',
    source: 'Fetch existing prompts',
    target: 'Fetch trusted sources',
  },
  {
    type: 'addConnection',
    source: 'Fetch trusted sources',
    target: 'Fetch long-running saker',
  },
];

const outPath = process.argv[2] || '/tmp/n8n-forum-prompts-topology-ops.json';
fs.writeFileSync(
  outPath,
  JSON.stringify({ workflowId: 'MloIdsnX7FozM4dv', operations }, null, 2),
);
console.log('Wrote', outPath, `(${operations.length} operations)`);
