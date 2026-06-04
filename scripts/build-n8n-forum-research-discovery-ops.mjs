#!/usr/bin/env node
/**
 * Build n8n update_workflow payload for forum-research-discovery v8 (code + SQL).
 * Topology changes require validate_workflow + full workflow replace or v8 topology script.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(
  path.join(root, 'workflows/n8n/forum-research-discovery.workflow.ts'),
  'utf8',
);
const ingestSrc = fs.readFileSync(
  path.join(root, 'workflows/n8n/forum-prompt-ingest.shared.ts'),
  'utf8',
);
const synthesisSrc = fs.readFileSync(
  path.join(root, 'workflows/n8n/forum-prompt-synthesis.shared.ts'),
  'utf8',
);
const enrichSrc = fs.readFileSync(
  path.join(root, 'workflows/n8n/forum-article-enrich.shared.ts'),
  'utf8',
);

function extract(from, name) {
  const re = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const m = from.match(re);
  if (!m) throw new Error(`missing const ${name}`);
  return m[1].replace(/\\\\/g, '\\');
}

function extractExport(from, name) {
  const re = new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`, 'm');
  const m = from.match(re);
  if (!m) throw new Error(`missing export ${name}`);
  return m[1];
}

function codeOp(nodeName, js) {
  return {
    type: 'updateNodeParameters',
    nodeName,
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: js },
    replace: true,
  };
}

function sqlOp(nodeName, query) {
  return {
    type: 'updateNodeParameters',
    nodeName,
    parameters: { operation: 'executeQuery', query },
    replace: true,
  };
}

const operations = [
  {
    type: 'setNodeParameter',
    nodeName: 'Discover stories (Ollama)',
    path: '/options/systemMessage',
    value: extract(src, 'DISCOVERY_SYSTEM'),
  },
  {
    type: 'setNodeParameter',
    nodeName: 'Deep research (Ollama)',
    path: '/options/systemMessage',
    value: extractExport(synthesisSrc, 'DEEP_RESEARCH_SYSTEM'),
  },
  {
    type: 'setNodeParameter',
    nodeName: 'Journalist (Ollama)',
    path: '/options/systemMessage',
    value: extractExport(synthesisSrc, 'JOURNALIST_SYSTEM'),
  },
  {
    type: 'setNodeParameter',
    nodeName: 'Editor (Ollama)',
    path: '/options/systemMessage',
    value: extractExport(synthesisSrc, 'EDITOR_SYSTEM'),
  },
  sqlOp('Fetch discovery context', extractExport(ingestSrc, 'DISCOVERY_CONTEXT_SQL')),
  codeOp('Reset run dedup state', extractExport(synthesisSrc, 'RESET_RUN_STATIC_JS')),
  codeOp('Fetch RSS headlines', extractExport(ingestSrc, 'FETCH_RSS_DISCOVERY_JS')),
  codeOp('Cluster headlines', extractExport(ingestSrc, 'RSS_CLUSTER_JS')),
  codeOp('Build discovery input', extract(src, 'BUILD_DISCOVERY_INPUT_JS')),
  codeOp('Enrich story articles', extractExport(enrichSrc, 'ENRICH_STORY_ARTICLES_JS')),
  codeOp('Prepare cluster saves', extract(src, 'PREPARE_CLUSTER_SAVES_JS')),
  codeOp('Expand article saves', extract(src, 'EXPAND_ARTICLE_SAVES_JS')),
  codeOp('Queue saved clusters', extract(src, 'QUEUE_SAVED_CLUSTERS_JS')),
  sqlOp('Fetch existing prompts', extractExport(synthesisSrc, 'EXISTING_PROMPTS_SQL')),
  sqlOp('Fetch trusted sources', extractExport(synthesisSrc, 'TRUSTED_SOURCES_SQL')),
  codeOp('Expand from saved', extractExport(synthesisSrc, 'EXPAND_SAVED_CLUSTER_JS')),
  codeOp('Build deep research input', extractExport(synthesisSrc, 'BUILD_DEEP_RESEARCH_INPUT_JS')),
  codeOp('Build journalist input', extractExport(synthesisSrc, 'BUILD_JOURNALIST_INPUT_JS')),
  codeOp('Build editor input', extractExport(synthesisSrc, 'BUILD_EDITOR_INPUT_JS')),
  codeOp('Finalize prompts', extractExport(synthesisSrc, 'FINALIZE_PROMPTS_JS')),
  codeOp('Prepare saves', extractExport(synthesisSrc, 'PREPARE_SAVES_JS')),
  codeOp('Prepare mark completed', extract(src, 'MARK_CLUSTER_COMPLETED_JS')),
  {
    type: 'updateNodeParameters',
    nodeName: 'check_duplicate',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: extractExport(synthesisSrc, 'CHECK_DUPLICATE_TOOL_JS'),
    },
    replace: true,
  },
];

const out = process.argv[2] || '/tmp/n8n-forum-research-discovery-ops.json';
fs.writeFileSync(out, JSON.stringify({ operations }, null, 2));
console.log('Wrote', out, 'with', operations.length, 'operations');
