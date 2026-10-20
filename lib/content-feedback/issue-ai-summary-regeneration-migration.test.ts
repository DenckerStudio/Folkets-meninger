import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const baseline = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261003160000_n8n_pipeline_ops.sql'),
  'utf-8',
);
const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261021140000_issue_ai_summary_regeneration.sql'),
  'utf-8',
);

const returnsMatch = baseline.match(
  /CREATE OR REPLACE FUNCTION public\.n8n_list_issues_missing_ai_summary\(p_limit int DEFAULT 1\)\s*RETURNS TABLE \(([\s\S]*?)\)\s*LANGUAGE sql/,
);
assert.ok(returnsMatch, 'baseline RETURNS TABLE block');
const baselineReturns = returnsMatch[1].trim();

const migrationReturnsMatch = migration.match(
  /CREATE OR REPLACE FUNCTION public\.n8n_list_issues_missing_ai_summary\(p_limit int DEFAULT 1\)\s*RETURNS TABLE \(([\s\S]*?)\)\s*LANGUAGE sql/,
);
assert.ok(migrationReturnsMatch, 'migration RETURNS TABLE block');
assert.equal(migrationReturnsMatch[1].trim(), baselineReturns);

assert.match(migration, /regeneration_requested_at timestamptz/i);
assert.match(migration, /OR s\.regeneration_requested_at IS NOT NULL/i);
assert.match(migration, /WHEN s\.stortinget_issue_id IS NULL THEN 0/i);
assert.match(migration, /WHEN s\.regeneration_requested_at IS NOT NULL THEN 1/i);
assert.match(migration, /s\.regeneration_requested_at ASC NULLS LAST/i);
assert.match(migration, /SET search_path = public, pg_temp/i);
assert.match(migration, /regeneration_requested_at = NULL/i);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_submit_content_feedback/i);
assert.match(migration, /regeneration_attempts int NOT NULL DEFAULT 0/i);
assert.match(migration, /regeneration_last_attempt_at timestamptz/i);
assert.match(migration, /n8n_mark_issue_ai_summary_regeneration_attempt/i);
assert.match(migration, /interval '15 minutes'/i);
assert.match(migration, /regeneration_attempts, 0\) < 5|coalesce\(s\.regeneration_attempts, 0\) < 5/i);

assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.n8n_list_issues_missing_ai_summary\(int\) FROM PUBLIC, anon, authenticated/i,
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_list_issues_missing_ai_summary\(int\) TO service_role/i,
);
assert.doesNotMatch(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_list_issues_missing_ai_summary[\s\S]*TO authenticated/i,
);

console.log('content-feedback/issue-ai-summary-regeneration-migration.test.ts: ok');
