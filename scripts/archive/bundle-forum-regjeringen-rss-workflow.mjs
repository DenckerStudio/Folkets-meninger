#!/usr/bin/env node
/** Inline shared constants for n8n validate_workflow / create_workflow_from_code */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'workflows/n8n');
const mainPath = path.join(root, 'forum-regjeringen-rss-ingest.workflow.ts');
let code = fs.readFileSync(mainPath, 'utf8');

function extractExport(from, name) {
  const re = new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const hit = from.match(re);
  if (!hit) throw new Error(`missing export ${name}`);
  return hit[1];
}

function inlineRegjeringenTemplate(regShared, ingestJs) {
  const junkM = regShared.match(/export const REGJERINGEN_JUNK_PATTERNS =\s*(\/[\s\S]*?\/i);/);
  if (junkM) {
    ingestJs = ingestJs.replace('${REGJERINGEN_JUNK_PATTERNS.toString()}', junkM[1]);
  }
  ingestJs = ingestJs.replace('${REGJERINGEN_RSS_ITEMS_LIMIT}', '40');
  return ingestJs;
}

const workflowShared = fs.readFileSync(path.join(root, 'forum-workflow.shared.ts'), 'utf8');
const regShared = fs.readFileSync(path.join(root, 'forum-regjeringen-ingest.shared.ts'), 'utf8');

const ingestJs = inlineRegjeringenTemplate(
  regShared,
  extractExport(regShared, 'REGJERINGEN_INGEST_JS'),
);

const rssUrlM = regShared.match(/export const REGJERINGEN_RSS_URL =\s*\n?\s*'([^']+)';/);
if (!rssUrlM) throw new Error('missing REGJERINGEN_RSS_URL');
const REGJERINGEN_RSS_URL = rssUrlM[1];

const blocks = [
  `const REGJERINGEN_RSS_URL = '${REGJERINGEN_RSS_URL}';`,
  `const REGJERINGEN_DEDUP_CONTEXT_SQL = \`${extractExport(workflowShared, 'REGJERINGEN_DEDUP_CONTEXT_SQL')}\`;`,
  `const REGJERINGEN_INGEST_JS = \`${ingestJs.replace(/`/g, '\\`')}\`;`,
  `const REGJERINGEN_BUILD_INSERT_JS = \`${extractExport(regShared, 'REGJERINGEN_BUILD_INSERT_JS')}\`;`,
  `const REGJERINGEN_LOG_EMPTY_JS = \`${extractExport(regShared, 'REGJERINGEN_LOG_EMPTY_JS')}\`;`,
];

code = code.replace(/^import \{[\s\S]*?\} from '@n8n\/workflow-sdk';\n/m, '');
code = code.replace(/import \{[^}]*\} from '\.\/forum-workflow\.shared';\n?/m, '');
code = code.replace(/import \{[^}]*\} from '\.\/forum-regjeringen-ingest\.shared';\n?/m, '');
code = `${blocks.join('\n\n')}\n\n${code}`;

const out = process.argv[2] || '/tmp/forum-regjeringen-rss-bundled.ts';
fs.writeFileSync(out, code);
console.log('Wrote', out, code.length, 'chars');
