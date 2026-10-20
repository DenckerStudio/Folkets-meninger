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

const baselineSelect = baseline.match(
  /JOIN LATERAL public\.n8n_get_issue_ai_summary_context\(i\.id\) ctx ON true\s*([\s\S]*?)ORDER BY/,
);
const migrationSelect = migration.match(
  /JOIN LATERAL public\.n8n_get_issue_ai_summary_context\(i\.id\) ctx ON true\s*([\s\S]*?)ORDER BY/,
);
assert.ok(baselineSelect && migrationSelect, 'SELECT projection blocks');
assert.equal(
  migrationSelect[0].replace(/OR s\.regeneration_requested_at IS NOT NULL\s*/i, '').replace(
    /CASE WHEN s\.regeneration_requested_at IS NOT NULL THEN 0 ELSE 1 END,\s*/i,
    '',
  ),
  baselineSelect[0],
);

assert.match(migration, /regeneration_requested_at timestamptz/i);
assert.match(migration, /OR s\.regeneration_requested_at IS NOT NULL/i);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.n8n_list_issues_missing_ai_summary\(int\) FROM PUBLIC, anon, authenticated/i,
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_list_issues_missing_ai_summary\(int\) TO service_role/i,
);
assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.n8n_list_issues_missing_ai_summary[\s\S]*TO authenticated/i);

console.log('content-feedback/issue-ai-summary-regeneration-migration.test.ts: ok');
