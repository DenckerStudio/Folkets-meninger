#!/usr/bin/env node
/**
 * Bundle forum v12 workflow sources and redeploy prompt generator.
 *
 * Usage:
 *   npm run deploy:forum-v12
 *   node scripts/deploy-forum-v12-workflows.mjs
 *
 * Live IDs (do not recreate unless intentional):
 *   RSS ingest:        6yy1ESY2Zy7cWgtF
 *   Prompt generator:  vOP2zPflfT0yBvDQ
 *
 * Archived v10/v11:
 *   Scout j6NZpV4IHP0AHFVj, Journalist sb31mc2dmhIvdbRg, Editor YY6u4GmeiZVk5R2e
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = path.join(root, '.tmp');

function bundle(script, outName) {
  const outPath = path.join(tmpDir, outName);
  fs.mkdirSync(tmpDir, { recursive: true });
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', script), outPath], {
    cwd: root,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
  return outPath;
}

const rssPath = bundle('bundle-forum-regjeringen-rss-workflow.mjs', 'forum-regjeringen-rss-bundled.ts');
const promptPath = bundle('bundle-forum-prompt-generator-workflow.mjs', 'forum-prompt-generator-bundled.ts');

const promptDeploy = spawnSync(
  process.execPath,
  [path.join(root, 'scripts/deploy-forum-v12-prompt-generator.mjs')],
  { cwd: root, encoding: 'utf8' },
);

console.log(
  JSON.stringify(
    {
      step: 'bundle_ok',
      rssPath,
      promptPath,
      rssLiveId: '6yy1ESY2Zy7cWgtF',
      promptLiveId: 'vOP2zPflfT0yBvDQ',
      rssUrl: 'https://n8n.heyklever.app/workflow/6yy1ESY2Zy7cWgtF',
      promptUrl: 'https://n8n.heyklever.app/workflow/vOP2zPflfT0yBvDQ',
      promptDeploy: promptDeploy.stdout?.trim() || promptDeploy.stderr?.trim(),
      archivedIds: ['j6NZpV4IHP0AHFVj', 'sb31mc2dmhIvdbRg', 'YY6u4GmeiZVk5R2e'],
      hint: 'RSS: node scripts/deploy-forum-v12-rss-ingest.mjs --temp-id <id> --publish. Prompt: deploy-forum-v12-prompt-generator.mjs',
    },
    null,
    2,
  ),
);

if (promptDeploy.status !== 0) process.exit(promptDeploy.status ?? 1);
