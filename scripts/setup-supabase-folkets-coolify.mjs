#!/usr/bin/env node
/**
 * Configure self-hosted Supabase (`supabase-folkets`) on Coolify:
 * - Enable GoTrue OAuth providers (Google + GitHub) in the service compose
 * - Set auth redirect / site URL env vars for folkets-meninger.no
 * - Restart the service
 * - Optionally apply repo migrations and seed vote_encryption_secret
 *
 * Requires a Coolify API token with deploy + env write access:
 *   https://coolify.heyklever.app → Keys & Tokens → API tokens
 *
 * Usage:
 *   export COOLIFY_API_TOKEN=...
 *   export GOOGLE_OAUTH_CLIENT_ID=...
 *   export GOOGLE_OAUTH_CLIENT_SECRET=...
 *   export GITHUB_OAUTH_CLIENT_ID=...
 *   export GITHUB_OAUTH_CLIENT_SECRET=...
 *   # optional for migrations:
 *   export HEYKLEVER_DATABASE_URL=postgres://postgres:...@host:5432/postgres
 *   node scripts/setup-supabase-folkets-coolify.mjs
 *   node scripts/setup-supabase-folkets-coolify.mjs --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

const DEFAULTS = {
  coolifyBaseUrl: 'https://coolify.heyklever.app/api/v1',
  serviceUuid: 'yfjwpr0riezmaxuekvradco4',
  supabasePublicUrl: 'https://supabase.heyklever.app',
  siteUrl: 'https://folkets-meninger.no',
  redirectAllowList: [
    'https://folkets-meninger.no/**',
    'https://*.folkets-meninger.no/**',
    'https://folketsstemme.no/**',
    'https://*.folketsstemme.no/**',
    'https://*.vercel.app/**',
    'http://localhost:3000/**',
    'http://127.0.0.1:3000/**',
  ].join(','),
};

const OAUTH_COMPOSE_LINES = [
  "      - 'GOTRUE_EXTERNAL_GITHUB_CLIENT_ID=${GOTRUE_EXTERNAL_GITHUB_CLIENT_ID}'",
  "      - 'GOTRUE_EXTERNAL_GITHUB_ENABLED=${GOTRUE_EXTERNAL_GITHUB_ENABLED}'",
  "      - 'GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI=${GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI}'",
  "      - 'GOTRUE_EXTERNAL_GITHUB_SECRET=${GOTRUE_EXTERNAL_GITHUB_SECRET}'",
  "      - 'GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=${GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID}'",
  "      - 'GOTRUE_EXTERNAL_GOOGLE_ENABLED=${GOTRUE_EXTERNAL_GOOGLE_ENABLED}'",
  "      - 'GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=${GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI}'",
  "      - 'GOTRUE_EXTERNAL_GOOGLE_SECRET=${GOTRUE_EXTERNAL_GOOGLE_SECRET}'",
];

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    skipCompose: argv.includes('--skip-compose'),
    skipMigrations: argv.includes('--skip-migrations'),
    skipRestart: argv.includes('--skip-restart'),
  };
}

function mask(value) {
  if (!value || value.length < 8) return '***';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

async function coolifyFetch(token, baseUrl, method, urlPath, body) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
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
    const msg = json?.message || json?.error || text || res.statusText;
    throw new Error(`${method} ${urlPath} → ${res.status}: ${msg}`);
  }
  return json;
}

function decodeComposeRaw(service) {
  const raw = service?.docker_compose_raw ?? service?.docker_compose;
  if (!raw) return null;
  try {
    return Buffer.from(raw, 'base64').toString('utf8');
  } catch {
    return typeof raw === 'string' ? raw : null;
  }
}

function enableOAuthInCompose(composeText) {
  if (!composeText) {
    throw new Error('Service compose text is empty — fetch failed or field missing.');
  }

  const alreadyEnabled = OAUTH_COMPOSE_LINES.every((line) => {
    const key = line.match(/GOTRUE_EXTERNAL_[A-Z_]+/)?.[0];
    return key && composeText.includes(key) && !composeText.includes(`#- '${key}`);
  });
  if (alreadyEnabled) {
    return { composeText, changed: false };
  }

  let updated = composeText;
  for (const line of OAUTH_COMPOSE_LINES) {
    const commented = `#- '${line.slice(9).replace(/^'|'\s*$/g, '')}'`;
    const uncommented = line;
    if (updated.includes(commented)) {
      updated = updated.replace(commented, uncommented);
      continue;
    }
    const altCommented = `#${line}`;
    if (updated.includes(altCommented)) {
      updated = updated.replace(altCommented, uncommented);
    }
  }

  const missing = OAUTH_COMPOSE_LINES.filter((line) => !updated.includes(line));
  if (missing.length > 0) {
    const anchor = '      - GOTRUE_EXTERNAL_PHONE_ENABLED=';
    const idx = updated.indexOf(anchor);
    if (idx === -1) {
      throw new Error(
        'Could not find supabase-auth phone env anchor in compose. Patch compose manually in Coolify UI.',
      );
    }
    const insertAt = updated.indexOf('\n', idx);
    updated =
      updated.slice(0, insertAt + 1) +
      missing.join('\n') +
      '\n' +
      updated.slice(insertAt + 1);
  }

  return { composeText: updated, changed: updated !== composeText };
}

function buildEnvUpdates(config) {
  const oauthCallback = `${config.supabasePublicUrl}/auth/v1/callback`;
  return [
    { key: 'SUPABASE_PUBLIC_URL', value: config.supabasePublicUrl },
    { key: 'API_EXTERNAL_URL', value: config.supabasePublicUrl },
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: config.supabasePublicUrl },
    { key: 'GOTRUE_SITE_URL', value: config.siteUrl },
    { key: 'ADDITIONAL_REDIRECT_URLS', value: config.redirectAllowList },
    { key: 'GOTRUE_EXTERNAL_GOOGLE_ENABLED', value: 'true' },
    { key: 'GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID', value: config.googleClientId },
    { key: 'GOTRUE_EXTERNAL_GOOGLE_SECRET', value: config.googleClientSecret },
    { key: 'GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI', value: oauthCallback },
    { key: 'GOTRUE_EXTERNAL_GITHUB_ENABLED', value: 'true' },
    { key: 'GOTRUE_EXTERNAL_GITHUB_CLIENT_ID', value: config.githubClientId },
    { key: 'GOTRUE_EXTERNAL_GITHUB_SECRET', value: config.githubClientSecret },
    { key: 'GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI', value: oauthCallback },
    { key: 'GOTRUE_MAILER_EXTERNAL_HOSTS', value: 'supabase.heyklever.app,supabase-kong' },
  ];
}

async function applyMigrations(databaseUrl, dryRun) {
  if (!databaseUrl) {
    console.warn('HEYKLEVER_DATABASE_URL not set — skipping migrations.');
    return;
  }
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  console.log(`Applying ${files.length} migrations…`);
  for (const file of files) {
    const sqlPath = path.join(MIGRATIONS_DIR, file);
    console.log(`  → ${file}`);
    if (dryRun) continue;
    const result = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlPath], {
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      throw new Error(`Migration failed: ${file}`);
    }
  }
}

async function ensureVoteSecret(databaseUrl, dryRun) {
  if (!databaseUrl) return;
  const sql = `
INSERT INTO private.app_settings (key, value)
VALUES ('vote_encryption_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;
`;
  console.log('Ensuring vote_encryption_secret exists…');
  if (dryRun) return;
  const result = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error('Failed to seed vote_encryption_secret');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.COOLIFY_API_TOKEN?.trim();
  const baseUrl = process.env.COOLIFY_API_BASE_URL?.trim() || DEFAULTS.coolifyBaseUrl;
  const serviceUuid = process.env.COOLIFY_SERVICE_UUID?.trim() || DEFAULTS.serviceUuid;

  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || '';
  const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || '';
  const githubClientId = process.env.GITHUB_OAUTH_CLIENT_ID?.trim() || '';
  const githubClientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim() || '';
  const databaseUrl = process.env.HEYKLEVER_DATABASE_URL?.trim() || '';

  if (!token) {
    console.error('COOLIFY_API_TOKEN is required.');
    process.exit(1);
  }
  if (!googleClientId || !googleClientSecret || !githubClientId || !githubClientSecret) {
    console.error(
      'OAuth credentials required: GOOGLE_OAUTH_CLIENT_ID/SECRET and GITHUB_OAUTH_CLIENT_ID/SECRET',
    );
    process.exit(1);
  }

  const config = {
    supabasePublicUrl: process.env.SUPABASE_PUBLIC_URL?.trim() || DEFAULTS.supabasePublicUrl,
    siteUrl: process.env.GOTRUE_SITE_URL?.trim() || DEFAULTS.siteUrl,
    redirectAllowList:
      process.env.ADDITIONAL_REDIRECT_URLS?.trim() || DEFAULTS.redirectAllowList,
    googleClientId,
    googleClientSecret,
    githubClientId,
    githubClientSecret,
  };

  console.log(`Coolify: ${baseUrl}`);
  console.log(`Service: ${serviceUuid} (supabase-folkets)`);
  console.log(`Supabase URL: ${config.supabasePublicUrl}`);
  console.log(`GOTRUE_SITE_URL: ${config.siteUrl}`);
  console.log(`OAuth callback: ${config.supabasePublicUrl}/auth/v1/callback`);
  for (const { key, value } of buildEnvUpdates(config)) {
    if (key.includes('SECRET') || key.includes('KEY')) {
      console.log(`  ${key}=${mask(value)}`);
    } else {
      console.log(`  ${key}=${value}`);
    }
  }

  if (args.dryRun) {
    console.log('\nDry run — no Coolify API calls.');
    await applyMigrations(databaseUrl, true);
    await ensureVoteSecret(databaseUrl, true);
    return;
  }

  const service = await coolifyFetch(token, baseUrl, 'GET', `/services/${serviceUuid}`);
  const composeText = decodeComposeRaw(service);
  if (!args.skipCompose) {
    const { composeText: patched, changed } = enableOAuthInCompose(composeText);
    if (changed) {
      console.log('Patching service compose to enable GoTrue OAuth env passthrough…');
      await coolifyFetch(token, baseUrl, 'PATCH', `/services/${serviceUuid}`, {
        docker_compose_raw: Buffer.from(patched, 'utf8').toString('base64'),
      });
    } else {
      console.log('Compose already exposes GoTrue OAuth env vars.');
    }
  }

  console.log('Updating environment variables (bulk)…');
  await coolifyFetch(token, baseUrl, 'PATCH', `/services/${serviceUuid}/envs/bulk`, {
    data: buildEnvUpdates(config).map(({ key, value }) => ({ key, value })),
  });

  if (!args.skipRestart) {
    console.log('Restarting supabase-folkets…');
    await coolifyFetch(token, baseUrl, 'POST', `/services/${serviceUuid}/restart`);
  }

  if (!args.skipMigrations) {
    await applyMigrations(databaseUrl, false);
    await ensureVoteSecret(databaseUrl, false);
  }

  console.log('\nDone. Verify:');
  console.log(`  curl -sS ${config.supabasePublicUrl}/auth/v1/health`);
  console.log('  Sign in with Google/GitHub on /auth/login');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
