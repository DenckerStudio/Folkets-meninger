#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateWorkflow } from '@n8n/workflow-sdk';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function exportWorkflow(tsRel, jsonRel) {
  const tsFile = path.join(root, tsRel);
  const jsonFile = path.join(root, jsonRel);
  const mod = await import(pathToFileURL(tsFile).href);
  const json = mod.default.toJSON();
  const validation = validateWorkflow(json);
  if (!validation.valid) {
    throw new Error(`Workflow validation failed for ${tsRel}: ${JSON.stringify(validation.errors)}`);
  }
  fs.writeFileSync(jsonFile, JSON.stringify(json, null, 2));
  const dbNodes = json.nodes
    .filter((node) => node.type.includes('postgres') || node.type.includes('supabase'))
    .map((node) => `${node.name}:${node.type}`);
  console.log(JSON.stringify({ ok: true, jsonFile, nodeCount: json.nodes.length, dbNodes }, null, 2));
}

for (const [tsRel, jsonRel] of [
  ['workflows/n8n/document-embeddings.workflow.ts', 'workflows/n8n/document-embeddings.n8n.json'],
  ['workflows/n8n/ai-summary-backfill.workflow.ts', 'workflows/n8n/ai-summary-backfill.n8n.json'],
]) {
  await exportWorkflow(tsRel, jsonRel);
}
