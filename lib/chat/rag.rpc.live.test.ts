import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { retrieveSakContext, searchIssuesForChat } from '@/lib/chat/rag';

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
  const rpc = await supabase.rpc('search_stortinget_issues_for_chat', {
    p_query: 'Demo',
    p_limit: 5,
  });

  const listed = await searchIssuesForChat('200365', 3);
  const context = await retrieveSakContext({
    issueId: '200365',
    query: 'vektgrense førerkort',
  });
  const missing = await retrieveSakContext({
    issueId: '200417',
    query: '200417',
  });

  const payload = {
    urlHost: new URL(url).host,
    usedServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    rpcError: rpc.error?.message ?? null,
    listedIds: listed.map((issue) => issue.id),
    retrieve: {
      issueId: context.issue?.id ?? null,
      chunkCount: context.chunks.length,
      hasSummary: Boolean(context.summary),
      chunkKeys: context.chunks[0] ? Object.keys(context.chunks[0]) : [],
      note: context.note,
    },
    missing200417: {
      issueId: missing.issue?.id ?? null,
      note: missing.note,
    },
    note:
      'Overlay RAG reads public sak tables with the user session (anon fallback). ' +
      'Lexical RPCs stay service_role-only and are not required for the orb panel. ' +
      '200417 is a live Stortinget sak that may be absent from cache (honest empty).',
  };

  writeFileSync('/opt/cursor/artifacts/rag-rpc-live.json', JSON.stringify(payload, null, 2));

  assert.match(rpc.error?.message ?? '', /permission denied/i);
  assert.ok(listed.some((issue) => issue.id === '200365'));
  assert.equal(context.issue?.id, '200365');
  assert.ok(context.chunks.length > 0 || context.summary);
  assert.ok(!payload.retrieve.chunkKeys.includes('embedding'));
  if (!missing.issue) {
    assert.match(missing.note ?? '', /ingen matching sak/i);
  }
  console.log(
    'chat/rag.rpc.live.test.ts: ok',
    payload.retrieve.issueId,
    'chunks',
    payload.retrieve.chunkCount,
  );
}

void main();
