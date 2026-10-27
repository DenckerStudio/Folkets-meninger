#!/usr/bin/env node
/**
 * One-off helper: merge live prod export with repo parameter overrides, then canonicalize.
 * Not used in CI; run manually when rebasing pins from prod.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const livePath = process.argv[2];
const repoPath = path.join(root, 'workflows/n8n/document-embeddings.n8n.json');
const outPath = process.argv[3] || repoPath;

if (!livePath) {
  console.error('Usage: bootstrap-document-embeddings-n8n-json.mjs <live-export.json> [out]');
  process.exit(1);
}

const live = JSON.parse(fs.readFileSync(livePath, 'utf8'));
const repo = JSON.parse(fs.readFileSync(repoPath, 'utf8'));
const repoByName = new Map(repo.nodes.map((n) => [n.name, n]));

const mergedNodes = live.nodes.map((liveNode) => {
  const repoNode = repoByName.get(liveNode.name);
  if (!repoNode) {
    return { ...liveNode };
  }
  const merged = { ...liveNode };
  merged.parameters = repoNode.parameters;
  if (repoNode.credentials !== undefined) {
    merged.credentials = repoNode.credentials;
  }
  if (repoNode.onError !== undefined) {
    merged.onError = repoNode.onError;
  }
  if (repoNode.retryOnFail !== undefined) {
    merged.retryOnFail = repoNode.retryOnFail;
  }
  if (repoNode.maxTries !== undefined) {
    merged.maxTries = repoNode.maxTries;
  }
  if (repoNode.waitBetweenTries !== undefined) {
    merged.waitBetweenTries = repoNode.waitBetweenTries;
  }
  if (repoNode.alwaysOutputData !== undefined) {
    merged.alwaysOutputData = repoNode.alwaysOutputData;
  }
  if (liveNode.name === 'Webhook document embeddings' && repoNode.parameters) {
    merged.parameters = repoNode.parameters;
    merged.disabled = repoNode.disabled ?? false;
  }
  if (liveNode.name === 'Ollama embeddings') {
    merged.parameters = repoNode.parameters;
    merged.onError = 'continueErrorOutput';
  }
  return merged;
});

const { serializeDocumentEmbeddingsJson } = await import(
  pathToFileURL(path.join(root, 'workflows/n8n/canonicalize-document-embeddings-json.ts')).href
);

const workflow = {
  id: repo.id ?? 'folkets-document-embeddings',
  name: repo.name ?? live.name,
  nodes: mergedNodes,
  connections: live.connections,
  settings: repo.settings ?? {},
};

fs.writeFileSync(outPath, serializeDocumentEmbeddingsJson(workflow));
console.log(JSON.stringify({ ok: true, out: outPath, nodeCount: mergedNodes.length }));
