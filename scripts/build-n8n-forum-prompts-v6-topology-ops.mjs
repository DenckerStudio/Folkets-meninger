#!/usr/bin/env node
/**
 * n8n topology ops for forum prompts v6: AI moderation chain replaces Moderation + route code node.
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

function extractConst(name) {
  const re = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`missing ${name}`);
  return m[1];
}

const MODERATION_SYSTEM = extractConst('MODERATION_SYSTEM');

const operations = [
  { type: 'removeConnection', source: 'Generate prompts (Ollama)', target: 'Moderation + route' },
  { type: 'removeConnection', source: 'Moderation + route', target: 'Save prompt' },
  { type: 'removeNode', nodeName: 'Moderation + route' },
  {
    type: 'addNode',
    node: {
      name: 'Build moderation input',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2600, 96],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: extract('BUILD_MODERATION_INPUT_JS'),
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Moderate prompts (Ollama)',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 3.1,
      position: [2832, 96],
      parameters: {
        promptType: 'define',
        text: '={{ $json.moderationText }}',
        hasOutputParser: true,
        options: {
          systemMessage: MODERATION_SYSTEM,
          maxIterations: 3,
          returnIntermediateSteps: false,
          enableStreaming: false,
        },
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Moderation Ollama Chat Model',
      type: '@n8n/n8n-nodes-langchain.lmChatOllama',
      typeVersion: 1,
      position: [2832, 320],
      parameters: {
        model: 'llama3.1:8b',
        options: {
          think: false,
          temperature: 0.1,
          format: 'json',
          numPredict: 1400,
          numCtx: 8192,
        },
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Moderation JSON parser',
      type: '@n8n/n8n-nodes-langchain.outputParserStructured',
      typeVersion: 1.3,
      position: [3056, 320],
      parameters: {
        schemaType: 'fromJson',
        jsonSchemaExample:
          '{"approved_prompts":[{"question":"Støtter du nasjonalt forbud mot lasere?","novelty_explanation":"Artiklene omtaler debatt om lasere.","source_indices":[0,1,2],"topic_tags":["laser"],"sensitivity":"low","status":"active"}],"rejected":[{"question":"Hva mener du om politikken?","reason":"For vagt"}]}',
        autoFix: true,
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Prepare saves',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [3056, 96],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: extract('PREPARE_SAVES_JS'),
      },
    },
  },
  { type: 'addConnection', source: 'Generate prompts (Ollama)', target: 'Build moderation input' },
  {
    type: 'addConnection',
    source: 'Generate prompts (Ollama)',
    target: 'Build moderation input',
    sourceIndex: 1,
  },
  { type: 'addConnection', source: 'Build moderation input', target: 'Moderate prompts (Ollama)' },
  { type: 'addConnection', source: 'Moderate prompts (Ollama)', target: 'Prepare saves' },
  { type: 'addConnection', source: 'Prepare saves', target: 'Save prompt' },
  {
    type: 'addConnection',
    source: 'Moderation Ollama Chat Model',
    target: 'Moderate prompts (Ollama)',
    connectionType: 'ai_languageModel',
  },
  {
    type: 'addConnection',
    source: 'Moderation JSON parser',
    target: 'Moderate prompts (Ollama)',
    connectionType: 'ai_outputParser',
  },
  {
    type: 'addConnection',
    source: 'Moderation Ollama Chat Model',
    target: 'Moderation JSON parser',
    connectionType: 'ai_languageModel',
  },
];

const outPath = process.argv[2] || '/tmp/n8n-forum-prompts-v6-topology-ops.json';
fs.writeFileSync(
  outPath,
  JSON.stringify({ workflowId: 'MloIdsnX7FozM4dv', operations }, null, 2),
);
console.log('Wrote', outPath, `(${operations.length} operations)`);
