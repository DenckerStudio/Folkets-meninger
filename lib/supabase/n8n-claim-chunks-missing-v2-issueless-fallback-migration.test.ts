import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20261112120000_n8n_claim_chunks_missing_v2_issueless_fallback.sql',
);
const priorPath = join(
  process.cwd(),
  'supabase/migrations/20261111090000_n8n_claim_chunks_missing_v2_progress_guard.sql',
);

const migration = readFileSync(migrationPath, 'utf8');
const prior = readFileSync(priorPath, 'utf8');

assert.match(
  migration,
  /CREATE OR REPLACE FUNCTION public\.n8n_claim_chunks_missing_v2\(\s*p_lane text,/,
);
assert.match(migration, /SECURITY DEFINER/);
assert.match(migration, /SET search_path = public, pg_temp/);

assert.match(
  migration,
  /INSERT INTO _fm_v2_claim_pending_issues \(issue_id\)[\s\S]*WHERE c\.issue_id IS NOT NULL/,
);
assert.match(migration, /INNER JOIN _fm_v2_claim_pending_issues pi ON pi\.issue_id = t\.issue_id/);

assert.match(
  migration,
  /IF v_lane = 'background' AND \(SELECT count\(\*\)::int FROM _fm_v2_claim_picked\) = 0 THEN/,
);
assert.match(
  migration,
  /WHERE c\.issue_id IS NULL[\s\S]*FOR UPDATE OF c SKIP LOCKED/,
);
assert.doesNotMatch(
  migration,
  /IF v_lane = 'background'[\s\S]*issue_id IS NULL[\s\S]*FOR v_tier_sort IN/,
);

assert.match(migration, /ORDER BY c\.created_at ASC NULLS LAST, c\.id ASC/);

assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.n8n_claim_chunks_missing_v2\(text, int, text, int\) FROM PUBLIC, anon, authenticated;/,
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_claim_chunks_missing_v2\(text, int, text, int\) TO service_role;/,
);
assert.doesNotMatch(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_claim_chunks_missing_v2[\s\S]*TO authenticated;/,
);
assert.doesNotMatch(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_claim_chunks_missing_v2[\s\S]*TO anon;/,
);

assert.match(prior, /WHERE c\.issue_id IS NOT NULL/);
assert.doesNotMatch(
  prior,
  /WHERE c\.issue_id IS NULL[\s\S]*embedding_v2_status = 'pending'/,
);

console.log(
  'lib/supabase/n8n-claim-chunks-missing-v2-issueless-fallback-migration.test.ts: ok',
);
