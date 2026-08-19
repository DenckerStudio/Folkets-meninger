#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'workflows/n8n');
const mainPath = path.join(root, 'forum-story-research.workflow.ts');
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
  'RESEARCH_JOURNALIST_SYSTEM',
  'EXISTING_PROMPTS_FOR_EDITOR_SQL',
  'CLAIM_NEXT_ACCEPTED_CLUSTER_SQL',
  'FETCH_STORY_FOR_RESEARCH_SQL',
]) {
  blocks.push(`const ${name} = \`${extractExport(shared, name)}\`;`);
}

code = code.replace(/import \{[^}]*\} from '\.\/forum-workflow\.shared';\n?/m, '');
code = `${blocks.join('\n\n')}\n\n${code}`;

const out = process.argv[2] || '/tmp/forum-story-research-bundled.ts';
fs.writeFileSync(out, code);
console.log('Wrote', out, code.length, 'chars');
