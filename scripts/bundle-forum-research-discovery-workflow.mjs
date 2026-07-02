#!/usr/bin/env node
/** Inline shared constants for n8n validate_workflow / create_workflow_from_code */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'workflows/n8n');
const mainPath = path.join(root, 'forum-research-discovery.workflow.ts');
let code = fs.readFileSync(mainPath, 'utf8');

function extractExport(from, name) {
  const re = new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const hit = from.match(re);
  if (!hit) throw new Error(`missing export ${name}`);
  return hit[1];
}

function inlineScoutIngestTemplate(scoutShared, ingestJs) {
  const feedsM = scoutShared.match(/export const SCOUT_RSS_FEEDS = (\[[\s\S]*?\]) as const;/);
  if (feedsM) {
    ingestJs = ingestJs.replace('${JSON.stringify(SCOUT_RSS_FEEDS)}', feedsM[1]);
  }
  const junkM = scoutShared.match(/export const SCOUT_JUNK_PATTERNS =\s*(\/[\s\S]*?\/i);/);
  if (junkM) {
    ingestJs = ingestJs.replace('${SCOUT_JUNK_PATTERNS.toString()}', junkM[1]);
  }
  const infraM = scoutShared.match(/export const SCOUT_INFRA_JUNK_PATTERNS =\s*(\/[\s\S]*?\/i);/);
  if (infraM) {
    ingestJs = ingestJs.replace('${SCOUT_INFRA_JUNK_PATTERNS.toString()}', infraM[1]);
  }
  const polM = scoutShared.match(/export const SCOUT_POLITICS_PATTERNS =\s*(\/[\s\S]*?\/i);/);
  if (polM) {
    ingestJs = ingestJs.replace('${SCOUT_POLITICS_PATTERNS.toString()}', polM[1]);
  }
  const searxM = scoutShared.match(/export const SCOUT_SEARXNG_BASE_URL = '([^']+)';/);
  if (searxM) {
    ingestJs = ingestJs.replace('${JSON.stringify(SCOUT_SEARXNG_BASE_URL)}', JSON.stringify(searxM[1]));
  }
  ingestJs = ingestJs.replace('${SCOUT_RSS_ITEMS_PER_FEED}', '12');
  return ingestJs;
}

const workflowShared = fs.readFileSync(path.join(root, 'forum-workflow.shared.ts'), 'utf8');
const scoutShared = fs.readFileSync(path.join(root, 'forum-scout-ingest.shared.ts'), 'utf8');

const ingestJs = inlineScoutIngestTemplate(
  scoutShared,
  extractExport(scoutShared, 'SCOUT_INGEST_AND_CLUSTER_JS'),
);

const searxUrlM = scoutShared.match(/export const SCOUT_SEARXNG_BASE_URL = '([^']+)';/);
const searxUrl = searxUrlM ? searxUrlM[1] : 'https://search.heyklever.app';
const prefetchJs = extractExport(scoutShared, 'SCOUT_PREFETCH_DEBATTEN_JS').replace(
  '${JSON.stringify(SCOUT_SEARXNG_BASE_URL)}',
  JSON.stringify(searxUrl),
);

const blocks = [
  `const DISCOVERY_CONTEXT_SQL = \`${extractExport(workflowShared, 'DISCOVERY_CONTEXT_SQL')}\`;`,
  `const SCOUT_PICK_SYSTEM = \`${extractExport(workflowShared, 'SCOUT_PICK_SYSTEM')}\`;`,
  `const SCOUT_INGEST_AND_CLUSTER_JS = \`${ingestJs.replace(/`/g, '\\`')}\`;`,
  `const SCOUT_PREFETCH_DEBATTEN_JS = \`${prefetchJs.replace(/`/g, '\\`')}\`;`,
  `const SCOUT_LOG_EMPTY_INGEST_JS = \`${extractExport(scoutShared, 'SCOUT_LOG_EMPTY_INGEST_JS')}\`;`,
  `const SCOUT_BUILD_INSERT_QUERY_JS = \`${extractExport(scoutShared, 'SCOUT_BUILD_INSERT_QUERY_JS')}\`;`,
  `const SCOUT_ENRICH_ARTICLES_JS = \`${extractExport(scoutShared, 'SCOUT_ENRICH_ARTICLES_JS')}\`;`,
  `const NRK_DEBATTEN_SEARXNG_HINT = \`${extractExport(scoutShared, 'NRK_DEBATTEN_SEARXNG_HINT')}\`;`,
];

const sdkImportMatch = code.match(/^import \{[\s\S]*?\} from '@n8n\/workflow-sdk';\n/m);
if (!sdkImportMatch) throw new Error('missing @n8n/workflow-sdk import in source');
// SDK parser injects workflow/node/trigger/etc. — imports are not allowed in bundled code.
code = code.replace(/^import \{[\s\S]*?\} from '@n8n\/workflow-sdk';\n/m, '');
code = code.replace(/import \{[^}]*\} from '\.\/forum-workflow\.shared';\n?/m, '');
code = code.replace(/import \{[^}]*\} from '\.\/forum-scout-ingest\.shared';\n?/m, '');
code = code.replace(
  /\$\{JSON\.stringify\(NRK_DEBATTEN_SEARXNG_HINT\)\}/g,
  JSON.stringify(extractExport(scoutShared, 'NRK_DEBATTEN_SEARXNG_HINT')),
);
code = `${blocks.join('\n\n')}\n\n${code}`;

const out = process.argv[2] || '/tmp/forum-research-discovery-bundled.ts';
fs.writeFileSync(out, code);
console.log('Wrote', out, code.length, 'chars');
