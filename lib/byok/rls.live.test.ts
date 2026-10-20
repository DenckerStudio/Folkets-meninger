import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const envTestPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../.env.test');

function loadFolketsPublicEnv() {
  const text = readFileSync(envTestPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i);
    const value = line.slice(i + 1);
    if (key.startsWith('NEXT_PUBLIC_SUPABASE')) {
      process.env[key] = value;
    }
  }
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

loadFolketsPublicEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(url && url.includes('qetckokgtzbpunbzslfp'), 'Folkets Meninger URL missing');
assert.ok(anon, 'Folkets anon key missing');
assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, undefined);

async function main() {
  const supabase = createClient(url, anon);
  const [creds, secretCols] = await Promise.all([
    supabase.from('user_llm_credentials').select('user_id, key_last4').limit(1),
    supabase.from('user_llm_credentials').select('ciphertext_b64').limit(1),
  ]);

  const payload = {
    urlHost: new URL(url).host,
    usedServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    credentialsError: creds.error?.message ?? null,
    secretError: secretCols.error?.message ?? null,
    credentialRows: Array.isArray(creds.data) ? creds.data.length : 0,
    note: 'Anon must not read user_llm_credentials (metadata or ciphertext).',
  };

  const artifactDir = existsSync('/opt/cursor/artifacts')
    ? '/opt/cursor/artifacts'
    : path.join(process.cwd(), '.artifacts');
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(path.join(artifactDir, 'byok-rls-live.json'), JSON.stringify(payload, null, 2));

  assert.match(payload.credentialsError ?? '', /permission denied|not accept/i);
  assert.match(payload.secretError ?? '', /permission denied|not accept/i);
  assert.equal(payload.usedServiceRole, false);
  assert.equal(payload.credentialRows, 0);
  console.log('byok/rls.live.test.ts: ok', payload.credentialsError);
}

void main();
