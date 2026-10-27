import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20261027200000_drop_n8n_hearing_jsonb_overloads.sql',
);
const explicitArgPath = join(
  process.cwd(),
  'supabase/migrations/20261027150000_add_n8n_hearing_explicit_arg_rpcs.sql',
);

const migration = readFileSync(migrationPath, 'utf8');
const explicitArg = readFileSync(explicitArgPath, 'utf8');

const dropLines = migration.match(/DROP FUNCTION IF EXISTS public\.n8n_upsert_/g) ?? [];
assert.equal(dropLines.length, 2, 'must drop exactly two n8n_upsert_* jsonb overloads');

assert.match(
  migration,
  /DROP FUNCTION IF EXISTS public\.n8n_upsert_stortinget_hearing\(jsonb\);/,
);
assert.match(
  migration,
  /DROP FUNCTION IF EXISTS public\.n8n_upsert_hearing_document\(jsonb\);/,
);

assert.doesNotMatch(
  migration,
  /DROP FUNCTION IF EXISTS public\.n8n_upsert_stortinget_hearing\(\s*p_id/,
);
assert.doesNotMatch(
  migration,
  /DROP FUNCTION IF EXISTS public\.n8n_upsert_hearing_document\(\s*p_hearing_id/,
);

assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION public\.n8n_upsert_/);
assert.doesNotMatch(migration, /REVOKE ALL ON FUNCTION/);
assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION/);

assert.match(
  explicitArg,
  /CREATE OR REPLACE FUNCTION public\.n8n_upsert_stortinget_hearing\(\s*p_id text,/,
);
assert.match(
  explicitArg,
  /CREATE OR REPLACE FUNCTION public\.n8n_upsert_hearing_document\(\s*p_hearing_id text,\s*p_external_key text,/,
);

console.log('lib/supabase/drop-n8n-hearing-jsonb-overloads-migration.test.ts: ok');
