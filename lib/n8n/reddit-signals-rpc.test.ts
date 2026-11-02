import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261102200000_reddit_signals.sql'),
  'utf-8',
);

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.reddit_signals/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
assert.match(
  migration,
  /REVOKE ALL ON TABLE public\.reddit_signals FROM PUBLIC, anon, authenticated/i,
);
assert.match(migration, /GRANT ALL ON TABLE public\.reddit_signals TO service_role/i);
assert.doesNotMatch(migration, /\bauthor\b/i);
assert.doesNotMatch(migration, /\bselftext\b/i);
assert.doesNotMatch(migration, /\busername\b/i);

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.n8n_upsert_reddit_signals\(p_rows jsonb\)/i);
assert.match(migration, /SECURITY DEFINER/i);
assert.match(migration, /SET search_path = public, pg_temp/i);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.n8n_upsert_reddit_signals\(jsonb\) FROM PUBLIC, anon, authenticated/i,
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_upsert_reddit_signals\(jsonb\) TO service_role/i,
);
assert.match(migration, /v_len > 100/i);
assert.match(migration, /ON CONFLICT \(reddit_id\) DO UPDATE/i);
assert.match(migration, /COALESCE\(EXCLUDED\.related_issue_id, rs\.related_issue_id\)/i);
assert.match(migration, /'https:\/\/www\.reddit\.com\/comments\/' \|\| v_reddit_id/i);

const contract = readFileSync(
  join(process.cwd(), 'docs/n8n/reddit-signals-contract.md'),
  'utf-8',
);
assert.match(contract, /n8n_upsert_reddit_signals/);
assert.doesNotMatch(contract, /\/api\/ops\/reddit-signals/);

console.log('lib/n8n/reddit-signals-rpc.test.ts: ok');
