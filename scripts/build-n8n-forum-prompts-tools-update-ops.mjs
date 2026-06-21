#!/usr/bin/env node
/** Update existing tool nodes (schema + input parsing) on live forum prompts workflow. */
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

function expandToolJs(name) {
  let js = extract(name);
  if (js.startsWith('${TOOL_INPUT_PARSE_JS}')) {
    js = extract('TOOL_INPUT_PARSE_JS') + js.slice('${TOOL_INPUT_PARSE_JS}'.length);
  }
  return js;
}

const checkJs = expandToolJs('CHECK_DUPLICATE_TOOL_JS');
const readJs = expandToolJs('READ_ARTICLE_CLUSTERS_TOOL_JS');

const operations = [
  {
    type: 'updateNodeParameters',
    nodeName: 'check_duplicate',
    replace: true,
    parameters: {
      description:
        'Check duplicate forum poll questions. Call with JSON: {"question":"Støtter du ...?"}. Returns DUPLICATE or OK.',
      language: 'javaScript',
      specifyInputSchema: true,
      schemaType: 'fromJson',
      jsonSchemaExample: '{"question":"Støtter du nasjonalt forbud mot lasere?"}',
      jsCode: checkJs,
    },
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'read_article_clusters',
    replace: true,
    parameters: {
      description:
        'Read article excerpts for headline indices. Call with JSON: {"indices":"0,2,5"}. Returns title, URL, fetch status, and excerpt per index.',
      language: 'javaScript',
      specifyInputSchema: true,
      schemaType: 'fromJson',
      jsonSchemaExample: '{"indices":"0,2,5"}',
      jsCode: readJs,
    },
  },
];

const out = process.argv[2] || '/tmp/n8n-forum-prompts-tools-update-ops.json';
fs.writeFileSync(out, JSON.stringify({ workflowId: 'MloIdsnX7FozM4dv', operations }, null, 2));
console.log('Wrote', out);
