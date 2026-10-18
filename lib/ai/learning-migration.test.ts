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

console.log('learning-migration.test.ts: ok');
