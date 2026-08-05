#!/usr/bin/env node
/**
 * Push Supabase settings from `.env.test` (heyklever / local test) to Vercel
 * project environment variables for folkets-inspill.
 *
 * Requires a Vercel token with project env access:
 *   export VERCEL_TOKEN=<token from https://vercel.com/account/tokens>
 *
 * Optional server secret for heyklever (not in .env.test):
 *   export HEYKLEVER_SUPABASE_SERVICE_ROLE_KEY=<heyklever service role>
 *
 * Usage:
 *   npm run vercel:env:supabase
 *   npm run vercel:env:supabase -- --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ENV_TEST = path.join(ROOT, '.env.test');
const DEFAULT_TEAM_ID = 'team_2BA9Wgixb4ridfpbTQWZlex8';
const DEFAULT_PROJECT = 'folkets-inspill';

const TARGETS = ['production', 'preview', 'development'];

function parseEnvFile(filePath) {
  const map = new Map();
  if (!fs.existsSync(filePath)) return map;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    map.set(line.slice(0, i).trim(), line.slice(i + 1).trim());
  }
  return map;
}

function mask(value) {
  if (!value || value.length < 12) return '***';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

async function vercelFetch(token, method, urlPath, body) {
  const res = await fetch(`https://api.vercel.com${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || text || res.statusText;
    throw new Error(`${method} ${urlPath} → ${res.status}: ${msg}`);
  }
  return json;
}

async function upsertEnv(token, teamId, project, entry) {
  const qs = new URLSearchParams({ upsert: 'true', teamId });
  return vercelFetch(
    token,
    'POST',
    `/v10/projects/${encodeURIComponent(project)}/env?${qs}`,
    entry,
  );
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const token = process.env.VERCEL_TOKEN?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || DEFAULT_TEAM_ID;
  const project = process.env.VERCEL_PROJECT_NAME?.trim() || DEFAULT_PROJECT;

  const fromFile = parseEnvFile(ENV_TEST);
  const url = fromFile.get('NEXT_PUBLIC_SUPABASE_URL');
  const anon = fromFile.get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serviceRole =
    process.env.HEYKLEVER_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    (process.argv.includes('--with-current-service-role')
      ? process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      : '') ||
    fromFile.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
    '';

  if (!url || !anon) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.test');
    process.exit(1);
  }

  const entries = [
    {
      key: 'NEXT_PUBLIC_SUPABASE_URL',
      value: url,
      type: 'plain',
      target: TARGETS,
      comment: 'Self-hosted test Supabase (heyklever) — synced from .env.test',
    },
    {
      key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      value: anon,
      type: 'encrypted',
      target: TARGETS,
      comment: 'Anon key for heyklever Supabase',
    },
  ];

  if (serviceRole) {
    entries.push({
      key: 'SUPABASE_SERVICE_ROLE_KEY',
      value: serviceRole,
      type: 'sensitive',
      target: TARGETS,
      comment: 'Service role for heyklever Supabase (server-only)',
    });
  } else {
    console.warn(
      'WARN: HEYKLEVER_SUPABASE_SERVICE_ROLE_KEY not set — skipping service role.\n' +
        '      Set it (or pass --with-current-service-role) before syncing server RPC env.',
    );
  }

  console.log(`Vercel project: ${project} (team ${teamId})`);
  for (const e of entries) {
    console.log(`  ${e.key}=${mask(e.value)} → ${e.target.join(', ')}`);
  }

  if (dryRun) {
    console.log('\nDry run — no API calls made.');
    return;
  }

  if (!token) {
    console.error(
      '\nVERCEL_TOKEN is not set. Create one at https://vercel.com/account/tokens and re-run:\n' +
        '  VERCEL_TOKEN=... npm run vercel:env:supabase',
    );
    process.exit(1);
  }

  for (const entry of entries) {
    await upsertEnv(token, teamId, project, entry);
    console.log(`Updated ${entry.key}`);
  }

  console.log('\nDone. Redeploy production/preview for changes to apply to running deployments.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
