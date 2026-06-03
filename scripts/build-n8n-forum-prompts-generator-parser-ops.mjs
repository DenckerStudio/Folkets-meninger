#!/usr/bin/env node
/** Add Prompts JSON parser + enable structured output on Generate prompts (Ollama). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(
  path.join(root, 'workflows/n8n/forum-trending-prompts.workflow.ts'),
  'utf8',
);

const schemaMatch = src.match(
  /jsonSchemaExample:\s*\n\s*'(\{[^']+\})'/,
);
const promptsSchema =
  '{"prompts":[{"question":"Støtter du nasjonalt forbud mot lasere?","novelty_explanation":"Artiklene omtaler politisk debatt om lasere.","source_indices":[0,1,2],"topic_tags":["laser"],"sensitivity":"low"}]}';

const operations = [
  {
    type: 'addNode',
    node: {
      name: 'Prompts JSON parser',
      type: '@n8n/n8n-nodes-langchain.outputParserStructured',
      typeVersion: 1.3,
      position: [2368, 336],
      parameters: {
        jsonSchemaExample: promptsSchema,
        autoFix: true,
      },
    },
  },
  {
    type: 'addConnection',
    source: 'Ollama Chat Model',
    target: 'Prompts JSON parser',
    connectionType: 'ai_languageModel',
  },
  {
    type: 'addConnection',
    source: 'Prompts JSON parser',
    target: 'Generate prompts (Ollama)',
    connectionType: 'ai_outputParser',
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Generate prompts (Ollama)',
    parameters: { hasOutputParser: true },
  },
];

const outPath = process.argv[2] || '/tmp/n8n-forum-prompts-parser-ops.json';
fs.writeFileSync(
  outPath,
  JSON.stringify({ workflowId: 'MloIdsnX7FozM4dv', operations }, null, 2),
);
console.log('Wrote', outPath);
