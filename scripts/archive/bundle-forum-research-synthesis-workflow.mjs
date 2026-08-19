#!/usr/bin/env node
/** @deprecated Alias – use bundle-forum-story-research-workflow.mjs */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bundle-forum-story-research-workflow.mjs');
const out = process.argv[2] || '/tmp/forum-research-synthesis-bundled.ts';
const r = spawnSync(process.execPath, [script, out], { stdio: 'inherit' });
process.exit(r.status ?? 1);
