#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'workflows/n8n');
const mainPath = path.join(root, 'forum-prompt-generator.workflow.ts');
let code = fs.readFileSync(mainPath, 'utf8');
const shared = fs.readFileSync(path.join(root, 'forum-workflow.shared.ts'), 'utf8');

function extractExport(from, name) {
  const re = new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const hit = from.match(re);
  if (!hit) throw new Error(`missing export ${name}`);
  return hit[1];
}

const blocks = [];
for (const name of [
  'PROMPT_GENERATOR_SYSTEM',
  'FETCH_CLUSTER_FOR_PROMPT_SQL',
  'PROMPT_GENERATOR_SAVE_JS',
  'MARK_CLUSTER_FAILED_PENDING_SQL',
]) {
  blocks.push(`const ${name} = \`${extractExport(shared, name)}\`;`);
}

code = code.replace(/^import \{[\s\S]*?\} from '@n8n\/workflow-sdk';\n/m, '');
code = code.replace(/import \{[^}]*\} from '\.\/forum-workflow\.shared';\n?/m, '');
const sdkImport =
  "import { workflow, node, trigger, sticky, newCredential, languageModel, outputParser, expr } from '@n8n/workflow-sdk';\n\n";
code = `${sdkImport}${blocks.join('\n\n')}\n\n${code}`;

const out = process.argv[2] || '/tmp/forum-prompt-generator-bundled.ts';
fs.writeFileSync(out, code);
console.log('Wrote', out, code.length, 'chars');
