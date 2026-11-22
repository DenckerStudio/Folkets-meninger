import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const baseMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261102200000_reddit_signals.sql'),
  'utf-8',
);
const v2Migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261116170000_reddit_signals_v2.sql'),
  'utf-8',
);
const coalesceMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261116183000_reddit_upsert_coalesce.sql'),
  'utf-8',
);

assert.match(baseMigration, /CREATE TABLE IF NOT EXISTS public\.reddit_signals/);
assert.doesNotMatch(baseMigration, /\bauthor\b/i);
assert.doesNotMatch(baseMigration, /\bselftext\b/i);
assert.doesNotMatch(baseMigration, /\busername\b/i);

assert.match(v2Migration, /reddit_blocklist/i);
assert.match(v2Migration, /reddit_signal_snapshots/i);
assert.match(v2Migration, /CREATE OR REPLACE FUNCTION public\.n8n_upsert_reddit_signals\(p_rows jsonb\)/i);
assert.match(v2Migration, /SECURITY DEFINER/i);
assert.match(v2Migration, /SET search_path = public, pg_temp/i);
assert.match(
  v2Migration,
  /REVOKE ALL ON FUNCTION public\.n8n_upsert_reddit_signals\(jsonb\) FROM PUBLIC, anon, authenticated/i,
);
assert.match(
  v2Migration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_upsert_reddit_signals\(jsonb\) TO service_role/i,
);
assert.match(v2Migration, /v_len > 100/i);
assert.match(v2Migration, /ON CONFLICT \(reddit_id\) DO UPDATE/i);
assert.match(v2Migration, /'blocked', v_blocked/i);
assert.match(v2Migration, /INSERT INTO public\.reddit_signal_snapshots/i);
assert.match(v2Migration, /reddit_signals_status_check/i);
assert.match(v2Migration, /COALESCE\(EXCLUDED\.related_issue_id, rs\.related_issue_id\)/i);
assert.doesNotMatch(
  v2Migration,
  /ON CONFLICT \(reddit_id\) DO UPDATE SET[\s\S]*status = EXCLUDED\.status/i,
);
assert.match(v2Migration, /'https:\/\/www\.reddit\.com\/comments\/' \|\| v_reddit_id/i);

assert.match(coalesceMigration, /CREATE OR REPLACE FUNCTION public\.n8n_upsert_reddit_signals\(p_rows jsonb\)/i);
assert.match(coalesceMigration, /matured_at = COALESCE\(EXCLUDED\.matured_at, rs\.matured_at\)/i);
assert.match(coalesceMigration, /ai_relevance = COALESCE\(EXCLUDED\.ai_relevance, rs\.ai_relevance\)/i);
assert.match(coalesceMigration, /cluster_id = COALESCE\(EXCLUDED\.cluster_id, rs\.cluster_id\)/i);
assert.match(coalesceMigration, /upvote_ratio = COALESCE\(EXCLUDED\.upvote_ratio, rs\.upvote_ratio\)/i);
assert.match(
  coalesceMigration,
  /REVOKE ALL ON FUNCTION public\.n8n_upsert_reddit_signals\(jsonb\) FROM PUBLIC, anon, authenticated/i,
);
assert.match(
  coalesceMigration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_upsert_reddit_signals\(jsonb\) TO service_role/i,
);
assert.match(coalesceMigration, /'blocked', v_blocked/i);

const contract = readFileSync(
  join(process.cwd(), 'docs/n8n/reddit-signals-contract.md'),
  'utf-8',
);
assert.match(contract, /n8n_upsert_reddit_signals/);
assert.doesNotMatch(contract, /\/api\/ops\/reddit-signals/);
assert.match(contract, /reply_worth/);

const replyWorthMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261122140000_reddit_reply_worth.sql'),
  'utf-8',
);
assert.match(
  replyWorthMigration,
  /CREATE OR REPLACE FUNCTION public\.n8n_set_reddit_reply_worth\(/i,
);
assert.match(
  replyWorthMigration,
  /CREATE OR REPLACE FUNCTION public\.n8n_list_reddit_reply_worth_candidates\(/i,
);
assert.match(
  replyWorthMigration,
  /REVOKE ALL ON FUNCTION public\.n8n_set_reddit_reply_worth\([\s\S]*?\)\s+FROM PUBLIC, anon, authenticated/i,
);
assert.match(
  replyWorthMigration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_set_reddit_reply_worth\([\s\S]*?\)\s+TO service_role/i,
);
assert.match(
  replyWorthMigration,
  /REVOKE ALL ON FUNCTION public\.n8n_list_reddit_reply_worth_candidates\(int\)\s+FROM PUBLIC, anon, authenticated/i,
);
assert.match(
  replyWorthMigration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_list_reddit_reply_worth_candidates\(int\)\s+TO service_role/i,
);
assert.doesNotMatch(replyWorthMigration, /\bselftext\b/i);
assert.doesNotMatch(replyWorthMigration, /\bauthor\b/i);

const replyWorthContract = readFileSync(
  join(process.cwd(), 'docs/n8n/reddit-reply-worth-contract.md'),
  'utf-8',
);
assert.match(replyWorthContract, /n8n_set_reddit_reply_worth/);
assert.match(replyWorthContract, /n8n_list_reddit_reply_worth_candidates/);

console.log('lib/n8n/reddit-signals-rpc.test.ts: ok');
