#!/usr/bin/env node
/**
 * Regenerate AI summaries via n8n webhook for issues missing v2 labels.
 *
 * Requires in .env.local:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - N8N_AI_SUMMARY_WEBHOOK_URL
 *
 * Usage:
 *   node scripts/backfill-ai-summaries-v2.mjs [--limit=20] [--delay-ms=8000]
 *   node scripts/backfill-ai-summaries-v2.mjs --all --limit=100
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
  let limit = 20;
  let delayMs = 8000;
  let all = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === '--all') all = true;
    if (arg.startsWith('--limit=')) limit = Number(arg.slice(8)) || 20;
    if (arg.startsWith('--delay-ms=')) delayMs = Number(arg.slice(11)) || 8000;
  }
  return { limit, delayMs, all };
}

async function supabaseFetch(table, query) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  const url = `${base}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${table} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function triggerWebhook(issueId, webhookUrl) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stortinget_issue_id: issueId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webhook ${issueId} failed: ${res.status} ${text}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  loadEnv();
  const { limit, delayMs, all } = parseArgs();
  const webhookUrl = process.env.N8N_AI_SUMMARY_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    throw new Error('Missing N8N_AI_SUMMARY_WEBHOOK_URL');
  }

  const select = 'stortinget_issue_id,labels,narrative,updated_at';
  const order = 'order=updated_at.asc';
  const rows = await supabaseFetch('issue_ai_summaries', `${select}&${order}&limit=1000`);

  const candidates = (Array.isArray(rows) ? rows : []).filter((row) => {
    const labels = Array.isArray(row.labels) ? row.labels : [];
    const hasNarrative = Boolean(String(row.narrative ?? '').trim());
    if (all) return labels.length < 2 || !hasNarrative;
    return labels.length < 2;
  });

  const batch = candidates.slice(0, limit);
  console.log(`Found ${candidates.length} issue(s) needing v2 regeneration; processing ${batch.length}.`);

  for (let i = 0; i < batch.length; i += 1) {
    const issueId = String(batch[i].stortinget_issue_id);
    console.log(`[${i + 1}/${batch.length}] Trigger ${issueId}`);
    await triggerWebhook(issueId, webhookUrl);
    if (i < batch.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
