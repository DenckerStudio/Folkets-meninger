#!/usr/bin/env node
/** Inline shared exports for n8n validate_workflow / create_workflow_from_code */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'workflows/n8n');
const mainPath = path.join(root, 'forum-research-discovery.workflow.ts');
let code = fs.readFileSync(mainPath, 'utf8');

const sharedFiles = [
  'forum-prompt-ingest.shared.ts',
  'forum-prompt-synthesis.shared.ts',
  'forum-article-enrich.shared.ts',
];

const PRIVATE_CONSTS = ['TOOL_INPUT_PARSE_JS'];

function extractBacktickConst(from, name, prefix = 'const') {
  const re = new RegExp(`^${prefix} ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const hit = from.match(re);
  if (!hit) return null;
  return hit[1];
}

const blocks = [];
for (const file of sharedFiles) {
  const shared = fs.readFileSync(path.join(root, file), 'utf8');
  for (const name of PRIVATE_CONSTS) {
    if (blocks.some((b) => b.startsWith(`const ${name} =`))) continue;
    const body = extractBacktickConst(shared, name);
    if (body) blocks.push(`const ${name} = \`${body}\`;`);
  }
  for (const m of shared.matchAll(/^export const (\w+)/gm)) {
    const name = m[1];
    const body = extractBacktickConst(shared, name, 'export const');
    if (!body) throw new Error(`missing export ${name} in ${file}`);
    blocks.push(`const ${name} = \`${body}\`;`);
  }
}

code = code.replace(/^import[\s\S]*?from '\.\/forum-article-enrich\.shared';\n\n/m, '');
code = code.replace(/^import[\s\S]*?from '\.\/forum-prompt-synthesis\.shared';\n/m, '');
code = code.replace(/^import[\s\S]*?from '\.\/forum-prompt-ingest\.shared';\n/m, '');
code = `${blocks.join('\n\n')}\n\n${code}`;

const out = process.argv[2] || '/tmp/forum-research-discovery-bundled.ts';
fs.writeFileSync(out, code);
console.log('Wrote', out, code.length, 'chars');
