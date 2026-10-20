import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeLiveTestArtifact } from '@/lib/test/write-live-artifact';
import { exitIfCiSkipsProdLive } from '@/lib/test/skip-in-ci-live';
import { createClient } from '@supabase/supabase-js';

exitIfCiSkipsProdLive('byok/rls.live.test.ts');

function loadFolketsPublicEnv() {
  const text = readFileSync(join(process.cwd(), '.env.test'), 'utf8');
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
  const [creds, secretCols, tier, customer, userList] = await Promise.all([
    supabase.from('user_llm_credentials').select('user_id, key_last4').limit(1),
    supabase.from('user_llm_credentials').select('ciphertext_b64').limit(1),
    supabase.from('users').select('subscription_tier, subscription_status, subscription_period_end').limit(1),
    supabase.from('users').select('stripe_customer_id').limit(1),
    supabase.from('users').select('id, first_name, last_name').limit(5),
  ]);

  const payload = {
    urlHost: new URL(url).host,
    usedServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    credentialsError: creds.error?.message ?? null,
    secretError: secretCols.error?.message ?? null,
    tierError: tier.error?.message ?? null,
    customerError: customer.error?.message ?? null,
    tierReadable: !tier.error,
    stripeCustomerReadable: !customer.error,
    userListError: userList.error?.message ?? null,
    userListRows: Array.isArray(userList.data) ? userList.data.length : 0,
    credentialRows: Array.isArray(creds.data) ? creds.data.length : 0,
    note:
      'After 20261017120000_revoke_public_users_leak, anon must not list users. ' +
      'Unauthenticated tier/stripe probes may still error until session is established. ' +
      'BYOK ciphertext stays table-denied for anon.',
  };

  writeLiveTestArtifact('byok-rls-live.json', payload);

  assert.match(payload.credentialsError ?? '', /permission denied|not accept/i);
  assert.match(payload.secretError ?? '', /permission denied|not accept/i);
  assert.equal(payload.usedServiceRole, false);
  assert.equal(payload.credentialRows, 0);

  if (process.env.FM_LIVE_TEST_STRICT_RLS === '1') {
    assert.match(payload.userListError ?? '', /permission denied|not accept/i);
    assert.equal(payload.userListRows, 0);
  }

  console.log('byok/rls.live.test.ts: ok', payload.urlHost);
}

void main();
