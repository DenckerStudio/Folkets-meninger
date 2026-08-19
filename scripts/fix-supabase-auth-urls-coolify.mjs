#!/usr/bin/env node
/**
 * Fix GoTrue email/OAuth links on self-hosted supabase-folkets:
 * - Verification emails must use https://supabase.heyklever.app (not http://supabase-kong:8000)
 * - Post-verify redirect must use the frontend (https://folketsstemme.no), not the Supabase API host
 *
 * Usage:
 *   export COOLIFY_API_TOKEN=...
 *   node scripts/fix-supabase-auth-urls-coolify.mjs
 *   node scripts/fix-supabase-auth-urls-coolify.mjs --dry-run
 */
const DEFAULTS = {
  coolifyBaseUrl: 'https://coolify.heyklever.app/api/v1',
  serviceUuid: 'yfjwpr0riezmaxuekvradco4',
  supabasePublicUrl: 'https://supabase.heyklever.app',
  siteUrl: 'https://folketsstemme.no',
  redirectAllowList: [
    'https://folketsstemme.no/**',
    'https://*.folketsstemme.no/**',
    'https://folkets-meninger.no/**',
    'https://*.folkets-meninger.no/**',
    'https://*.vercel.app/**',
    'http://localhost:3000/**',
    'http://127.0.0.1:3000/**',
  ].join(','),
  mailerExternalHosts: 'supabase.heyklever.app,supabase-kong',
};

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    skipRestart: argv.includes('--skip-restart'),
  };
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

function buildEnvUpdates(config) {
  return [
    { key: 'SUPABASE_PUBLIC_URL', value: config.supabasePublicUrl },
    { key: 'API_EXTERNAL_URL', value: config.supabasePublicUrl },
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: config.supabasePublicUrl },
    { key: 'GOTRUE_SITE_URL', value: config.siteUrl },
    { key: 'ADDITIONAL_REDIRECT_URLS', value: config.redirectAllowList },
    { key: 'GOTRUE_MAILER_EXTERNAL_HOSTS', value: config.mailerExternalHosts },
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.COOLIFY_API_TOKEN?.trim();
  const baseUrl = process.env.COOLIFY_API_BASE_URL?.trim() || DEFAULTS.coolifyBaseUrl;
  const serviceUuid = process.env.COOLIFY_SERVICE_UUID?.trim() || DEFAULTS.serviceUuid;

  if (!token) {
    console.error('COOLIFY_API_TOKEN is required.');
    process.exit(1);
  }

  const config = {
    supabasePublicUrl: process.env.SUPABASE_PUBLIC_URL?.trim() || DEFAULTS.supabasePublicUrl,
    siteUrl: process.env.GOTRUE_SITE_URL?.trim() || DEFAULTS.siteUrl,
    redirectAllowList:
      process.env.ADDITIONAL_REDIRECT_URLS?.trim() || DEFAULTS.redirectAllowList,
    mailerExternalHosts:
      process.env.GOTRUE_MAILER_EXTERNAL_HOSTS?.trim() || DEFAULTS.mailerExternalHosts,
  };

  console.log('Fixing GoTrue auth URL env vars on supabase-folkets…');
  console.log(`  API_EXTERNAL_URL=${config.supabasePublicUrl}`);
  console.log(`  GOTRUE_SITE_URL=${config.siteUrl}`);
  console.log(`  ADDITIONAL_REDIRECT_URLS=${config.redirectAllowList}`);
  console.log(`  GOTRUE_MAILER_EXTERNAL_HOSTS=${config.mailerExternalHosts}`);

  if (args.dryRun) {
    console.log('\nDry run — no Coolify API calls.');
    return;
  }

  await coolifyFetch(token, baseUrl, 'PATCH', `/services/${serviceUuid}/envs/bulk`, {
    data: buildEnvUpdates(config).map(({ key, value }) => ({ key, value })),
  });

  if (!args.skipRestart) {
    console.log('Restarting supabase-folkets…');
    await coolifyFetch(token, baseUrl, 'POST', `/services/${serviceUuid}/restart`);
  }

  console.log('\nDone. Re-send a signup email and confirm the link uses:');
  console.log(`  ${config.supabasePublicUrl}/auth/v1/verify?...&redirect_to=${config.siteUrl}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
