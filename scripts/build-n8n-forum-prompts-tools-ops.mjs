#!/usr/bin/env node
/**
 * n8n ops: add check_duplicate + read_article_clusters tools wired to the agent.
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
    type: 'addNode',
    node: {
      name: 'check_duplicate',
      type: '@n8n/n8n-nodes-langchain.toolCode',
      typeVersion: 1.3,
      position: [2320, 480],
      parameters: {
        description:
          'Check if a proposed forum poll question is a duplicate or near-duplicate of existing prompts. Input: the full question text. Returns DUPLICATE or OK.',
        language: 'javaScript',
        jsCode: extract('CHECK_DUPLICATE_TOOL_JS'),
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'read_article_clusters',
      type: '@n8n/n8n-nodes-langchain.toolCode',
      typeVersion: 1.3,
      position: [2480, 480],
      parameters: {
        description:
          'Read fetched article excerpts for headline indices. Input: comma-separated indices e.g. "0,2,5". Returns title, URL, fetch status, and article text excerpt per index.',
        language: 'javaScript',
        jsCode: extract('READ_ARTICLE_CLUSTERS_TOOL_JS'),
      },
    },
  },
  {
    type: 'addConnection',
    source: 'check_duplicate',
    target: 'Generate prompts (Ollama)',
    connectionType: 'ai_tool',
  },
  {
    type: 'addConnection',
    source: 'read_article_clusters',
    target: 'Generate prompts (Ollama)',
    connectionType: 'ai_tool',
  },
];

const outPath = process.argv[2] || '/tmp/n8n-forum-prompts-tools-ops.json';
fs.writeFileSync(
  outPath,
  JSON.stringify({ workflowId: 'MloIdsnX7FozM4dv', operations }, null, 2),
);
console.log('Wrote', outPath, `(${operations.length} operations)`);
