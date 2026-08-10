#!/usr/bin/env node
/**
 * Run forum trending prompts workflow until at least one active reel exists (or max attempts).
 * Requires: N8N_API_KEY (or MCP), NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage: node scripts/run-forum-prompts-until-reel.mjs [--max=5] [--wait-ms=300000]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW_ID = 'MloIdsnX7FozM4dv';
const N8N_BASE = process.env.N8N_API_URL || 'https://n8n.heyklever.app';

function loadEnv() {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function parseArgs() {
  let maxAttempts = 5;
  let waitMs = 300_000;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--max=')) maxAttempts = Number(arg.slice(6)) || 5;
    if (arg.startsWith('--wait-ms=')) waitMs = Number(arg.slice(10)) || 300_000;
  }
  return { maxAttempts, waitMs };
}

async function countActivePrompts() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL/key in .env.local');
  const q =
    `${url}/rest/v1/forum_prompts?select=id,question,created_at` +
    `&status=eq.active&or=(expires_at.is.null,expires_at.gt.${encodeURIComponent(new Date().toISOString())})` +
    '&order=created_at.desc&limit=5';
  const res = await fetch(q, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function n8nFetch(path, opts = {}) {
  const apiKey = process.env.N8N_API_KEY;
  if (!apiKey) throw new Error('Set N8N_API_KEY in .env.local (n8n Settings → API)');
  const res = await fetch(`${N8N_BASE}${path}`, {
    ...opts,
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) throw new Error(`n8n ${res.status}: ${text.slice(0, 500)}`);
  return body;
}

async function startExecution() {
  const body = await n8nFetch(`/api/v1/workflows/${WORKFLOW_ID}/run`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return body.executionId || body.data?.executionId || body.id;
}

async function getExecution(executionId) {
  return n8nFetch(
    `/api/v1/executions/${executionId}?includeData=false`,
  );
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  loadEnv();
  const { maxAttempts, waitMs } = parseArgs();

  const before = await countActivePrompts();
  console.log(`Active reels before: ${before.length}`);
  if (before[0]) console.log(`  Latest: ${before[0].question}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n--- Attempt ${attempt}/${maxAttempts} ---`);
    const executionId = await startExecution();
    console.log(`Started execution ${executionId}`);

    const deadline = Date.now() + waitMs;
    let status = 'running';
    while (Date.now() < deadline) {
      await sleep(15_000);
      const ex = await getExecution(executionId);
      status = ex.status || ex.data?.status;
      console.log(`  status: ${status}`);
      if (status === 'success' || status === 'error' || status === 'crashed') break;
    }
    if (status !== 'success') {
      console.warn(`Execution ended with status=${status}`);
    }

    const after = await countActivePrompts();
    console.log(`Active reels now: ${after.length}`);
    if (after[0]) console.log(`  Latest: ${after[0].question}`);

    const newest = after[0];
    const hadNew =
      newest &&
      (!before[0] || newest.id !== before[0].id || newest.created_at !== before[0].created_at);
    if (after.length > 0 && (hadNew || after.length > before.length)) {
      console.log('\nDone: active reel(s) available.');
      process.exit(0);
    }
  }

  console.error('\nNo new active reel after max attempts. Check n8n execution Prepare saves / Generate prompts.');
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
