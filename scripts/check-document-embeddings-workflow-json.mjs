#!/usr/bin/env node
/**
 * Fail if document-embeddings.n8n.json drifts from the TypeScript exporter output.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const committed = path.join(root, 'workflows/n8n/document-embeddings.n8n.json');
const tmp = path.join(os.tmpdir(), `document-embeddings-export-${process.pid}.json`);

execSync(`npx tsx scripts/export-document-embeddings-workflow-json.mjs "${tmp}"`, {
  cwd: root,
  stdio: 'pipe',
});

const expected = fs.readFileSync(committed, 'utf8');
const actual = fs.readFileSync(tmp, 'utf8');
fs.unlinkSync(tmp);

if (expected !== actual) {
  console.error(
    'document-embeddings.n8n.json does not match export-document-embeddings-workflow-json.mjs output.\n' +
      'Run: npx tsx scripts/export-document-embeddings-workflow-json.mjs workflows/n8n/document-embeddings.n8n.json',
  );
  process.exit(1);
}

console.log('check-document-embeddings-workflow-json.mjs: ok');
