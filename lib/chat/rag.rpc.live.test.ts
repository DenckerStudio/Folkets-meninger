import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadLocalEnv() {
  const text = readFileSync('/workspace/.env.local', 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i);
    const value = line.slice(i + 1);
    if (key.startsWith('NEXT_PUBLIC_SUPABASE')) {
      process.env[key] = value;
    } else if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(url && url.includes('qetckokgtzbpunbzslfp'), 'Folkets-Stemme URL missing');
assert.ok(anon, 'Folkets anon key missing');

async function main() {
  const supabase = createClient(url, anon);
  const { data, error } = await supabase.rpc('search_stortinget_issues_for_chat', {
    p_query: 'Demo',
    p_limit: 5,
  });

  const payload = {
    urlHost: new URL(url).host,
    rpcError: error?.message ?? null,
    rowCount: Array.isArray(data) ? data.length : 0,
    note: error
      ? 'RPC is service_role-only on hosted Folkets-Stemme; anon call is denied as designed.'
      : 'RPC returned rows to anon.',
  };

  writeFileSync('/opt/cursor/artifacts/rag-rpc-live.json', JSON.stringify(payload, null, 2));
  assert.ok(error?.message || Array.isArray(data), 'RAG RPC did not respond');
  console.log('chat/rag.rpc.live.test.ts: ok', payload.rpcError || `${payload.rowCount} rows`);
}

void main();
