#!/usr/bin/env node
/**
 * Regenerate workflows/n8n/document-embeddings.n8n.json from document-embeddings.workflow.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out =
  process.argv[2] || path.join(root, 'workflows/n8n/document-embeddings.n8n.json');

const mod = await import(
  pathToFileURL(path.join(root, 'workflows/n8n/document-embeddings.workflow.ts')).href
);
const json = mod.default.toJSON();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(json, null, 2));
console.log(JSON.stringify({ ok: true, out, nodeCount: json.nodes?.length, name: json.name }));
