import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadFolketsPublicEnv() {
  const text = readFileSync('/workspace/.env.test', 'utf8');
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
assert.ok(url && url.includes('qetckokgtzbpunbzslfp'), 'Folkets-Stemme URL missing');
assert.ok(anon, 'Folkets anon key missing');
assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, undefined);

async function main() {
  const supabase = createClient(url, anon);
  const [creds, secretCols, tier] = await Promise.all([
    supabase.from('user_llm_credentials').select('user_id, key_last4').limit(1),
    supabase.from('user_llm_credentials').select('ciphertext_b64').limit(1),
    supabase.from('users').select('subscription_tier').limit(1),
  ]);

  const payload = {
    urlHost: new URL(url).host,
    usedServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    credentialsError: creds.error?.message ?? null,
    secretError: secretCols.error?.message ?? null,
    tierError: tier.error?.message ?? null,
    credentialRows: Array.isArray(creds.data) ? creds.data.length : 0,
    note:
      'Anon cannot read BYOK ciphertext or subscription_tier. Owner reads need the request session after 20261003200000 is applied by ops.',
  };

  writeFileSync('/opt/cursor/artifacts/byok-rls-live.json', JSON.stringify(payload, null, 2));

  assert.match(payload.credentialsError ?? '', /permission denied|not accept/i);
  assert.match(payload.secretError ?? '', /permission denied|not accept/i);
  assert.ok(payload.tierError, 'anon must not read users.subscription_tier');
  assert.equal(payload.credentialRows, 0);
  console.log('byok/rls.live.test.ts: ok anon denied', payload.credentialsError);
}

void main();
