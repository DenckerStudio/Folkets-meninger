#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'workflows/n8n');
const mainPath = path.join(root, 'forum-sak-prompt-generator.workflow.ts');
let code = fs.readFileSync(mainPath, 'utf8');
const shared = fs.readFileSync(path.join(root, 'forum-sak-prompt.shared.ts'), 'utf8');

function extractExport(from, name) {
  const re = new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const hit = from.match(re);
  if (!hit) throw new Error(`missing export ${name}`);
  return hit[1];
}

function extractJsExport(from, name) {
  const re = new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const hit = from.match(re);
  if (!hit) throw new Error(`missing export ${name}`);
  return hit[1];
}

const blocks = [];
for (const name of [
  'FETCH_SAK_FOR_PROMPT_SQL',
  'RAG_RETRIEVE_SQL',
  'BUILD_RAG_QUERY_JS',
  'MAP_EMBEDDING_FOR_RAG_JS',
  'MERGE_RAG_CONTEXT_JS',
  'SAK_PROMPT_GENERATOR_SYSTEM',
  'SAK_PROMPT_GENERATOR_SAVE_JS',
]) {
  blocks.push(`const ${name} = \`${extractJsExport(shared, name)}\`;`);
}

code = code.replace(/^import \{[\s\S]*?\} from '@n8n\/workflow-sdk';\n/m, '');
code = code.replace(/import \{[^}]*\} from '\.\/forum-sak-prompt\.shared';\n?/m, '');
const sdkImport =
  "import { workflow, node, trigger, sticky, newCredential, languageModel, outputParser, expr, placeholder } from '@n8n/workflow-sdk';\n\n";
code = `${sdkImport}${blocks.join('\n\n')}\n\n${code}`;

const out = process.argv[2] || '/tmp/forum-sak-prompt-generator-bundled.ts';
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, code);
console.log('Wrote', out, code.length, 'chars');
