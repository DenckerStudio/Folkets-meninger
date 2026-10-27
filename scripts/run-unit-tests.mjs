#!/usr/bin/env node
/**
 * Kjør alle fm-web enhetstester under lib/, app/ og evals/ (*.test.ts).
 * cms/ har eget test:unit i unit-tests-jobben i CI.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TEST_ROOTS = ['lib', 'app', 'evals'];
const SKIP_DIR_NAMES = new Set(['node_modules', '.next', 'dist', '.git']);

/** @param {string} dir @param {string[]} acc */
function collectTestFiles(dir, acc) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name)) continue;
      collectTestFiles(full, acc);
    } else if (ent.isFile() && ent.name.endsWith('.test.ts')) {
      acc.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
}

const files = [];
for (const rel of TEST_ROOTS) {
  collectTestFiles(path.join(root, rel), files);
}
files.sort();

if (files.length === 0) {
  console.error('run-unit-tests.mjs: ingen *.test.ts-filer funnet');
  process.exit(1);
}

console.log(`run-unit-tests.mjs: kjører ${files.length} testfiler`);

let failed = 0;
for (const file of files) {
  const result = spawnSync('npx', ['tsx', file], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    failed += 1;
    if (result.error) {
      console.error(`run-unit-tests.mjs: feil ved kjøring av ${file}:`, result.error.message);
    }
    process.exit(result.status === null ? 1 : result.status);
  }
}

if (failed > 0) {
  process.exit(1);
}
