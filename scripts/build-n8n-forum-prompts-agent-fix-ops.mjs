#!/usr/bin/env node
/** Deploy agent output fixes: moderation recovery, output parser, remove memory. */
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

const moderationJs = extract('MODERATION_ROUTE_JS');
const promptSystem = (() => {
  const m = src.match(/const PROMPT_SYSTEM = `([\s\S]*?)`;/m);
  if (!m) throw new Error('missing PROMPT_SYSTEM');
  return m[1];
})();

const operations = [
  {
    type: 'updateNodeParameters',
    nodeName: 'Moderation + route',
    replace: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: moderationJs,
    },
  },
  {
    type: 'removeConnection',
    source: 'Prompt batch memory',
    target: 'Generate prompts (Ollama)',
    connectionType: 'ai_memory',
  },
  {
    type: 'setNodeParameter',
    nodeName: 'Generate prompts (Ollama)',
    path: '/hasOutputParser',
    value: true,
  },
  {
    type: 'setNodeParameter',
    nodeName: 'Generate prompts (Ollama)',
    path: '/options/systemMessage',
    value: promptSystem,
  },
  {
    type: 'addNode',
    node: {
      name: 'Prompts JSON parser',
      type: '@n8n/n8n-nodes-langchain.outputParserStructured',
      typeVersion: 1.3,
      position: [2480, 480],
      parameters: {
        schemaType: 'fromJson',
        jsonSchemaExample:
          '{"prompts":[{"question":"Støtter du nasjonalt forbud mot lasere?","novelty_explanation":"Artiklene beskriver …","source_indices":[0,1,2],"topic_tags":["laser"],"sensitivity":"low"}]}',
        autoFix: true,
      },
    },
  },
  {
    type: 'addConnection',
    source: 'Prompts JSON parser',
    target: 'Generate prompts (Ollama)',
    connectionType: 'ai_outputParser',
  },
  {
    type: 'addConnection',
    source: 'Ollama Chat Model',
    target: 'Prompts JSON parser',
    connectionType: 'ai_languageModel',
  },
];

const out = process.argv[2] || '/tmp/n8n-forum-prompts-agent-fix-ops.json';
fs.writeFileSync(out, JSON.stringify({ workflowId: 'MloIdsnX7FozM4dv', operations }, null, 2));
console.log('Wrote', out, `(${operations.length} ops)`);
