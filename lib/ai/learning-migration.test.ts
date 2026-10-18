import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261020100000_ai_learning.sql'),
  'utf-8',
);

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ai_generations/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ai_feedback/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ai_prompt_versions/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ai_eval_cases/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ai_eval_runs/);
assert.match(migration, /admin_activate_prompt_version/);
assert.match(migration, /GRANT EXECUTE ON FUNCTION %s TO authenticated/);
assert.match(migration, /ai_issue_summary_preserve/);
assert.match(migration, /ai_poll_feedback/);
assert.match(migration, /admin_poll_draft_action/);

const grants = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261020100100_ai_learning_n8n_grants.sql'),
  'utf-8',
);
assert.match(grants, /admin_poll_draft_action/);
assert.match(grants, /n8n_list_prompt_candidates/);
assert.match(grants, /n8n_record_eval_result/);
assert.match(grants, /n8n_ai_weekly_metrics/);

const align = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261020100200_ai_learning_n8n_align.sql'),
  'utf-8',
);
assert.match(align, /n8n_list_prompt_candidates\(p_workflow_key text\)/);
assert.match(align, /n8n_record_eval_run\(/);
assert.match(align, /n8n_record_eval_result\(/);
assert.match(align, /n8n_ai_weekly_metrics\(p_from timestamptz, p_to timestamptz\)/);
assert.match(align, /DROP FUNCTION IF EXISTS public\.n8n_upsert_issue_ai_summary\(/);
assert.match(align, /p_generation_metadata jsonb DEFAULT NULL/);
assert.match(align, /'sak_summary', 'sak-01'/);
assert.match(align, /REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated/);

console.log('learning-migration.test.ts: ok');
