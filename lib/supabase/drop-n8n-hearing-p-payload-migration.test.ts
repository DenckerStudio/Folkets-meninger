import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20261027150000_drop_n8n_hearing_p_payload_overloads.sql',
);
const hearingsBasePath = join(
  process.cwd(),
  'supabase/migrations/20261022102000_stortinget_hearings.sql',
);

const migration = readFileSync(migrationPath, 'utf8');
const hearingsBase = readFileSync(hearingsBasePath, 'utf8');

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
  /DROP FUNCTION IF EXISTS public\.n8n_upsert_stortinget_hearing\(\s*text,/,
);
assert.doesNotMatch(
  migration,
  /DROP FUNCTION IF EXISTS public\.n8n_upsert_hearing_document\(\s*text,/,
);

assert.match(
  migration,
  /CREATE OR REPLACE FUNCTION public\.n8n_upsert_stortinget_hearing\(\s*p_id text,/,
);
assert.match(
  migration,
  /CREATE OR REPLACE FUNCTION public\.n8n_upsert_hearing_document\(\s*p_hearing_id text,\s*p_external_key text,/,
);

assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.n8n_upsert_stortinget_hearing\([\s\S]*?\) FROM PUBLIC, anon, authenticated;/,
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_upsert_stortinget_hearing\([\s\S]*?\) TO service_role;/,
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_upsert_hearing_document\([\s\S]*?\) TO service_role;/,
);

assert.doesNotMatch(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_upsert_stortinget_hearing\(jsonb\)/,
);
assert.doesNotMatch(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.n8n_upsert_hearing_document\(jsonb\)/,
);

const dropJsonbAt = migration.indexOf('DROP FUNCTION IF EXISTS public.n8n_upsert_stortinget_hearing(jsonb)');
const createExplicitAt = migration.indexOf(
  'CREATE OR REPLACE FUNCTION public.n8n_upsert_stortinget_hearing(\n  p_id text',
);
assert.ok(
  createExplicitAt >= 0 && dropJsonbAt > createExplicitAt,
  'must CREATE explicit overloads before DROP jsonb wrappers',
);

assert.match(hearingsBase, /CREATE OR REPLACE FUNCTION public\.n8n_upsert_stortinget_hearing\(p_payload jsonb\)/);
assert.match(hearingsBase, /CREATE OR REPLACE FUNCTION public\.n8n_upsert_hearing_document\(p_payload jsonb\)/);

console.log('lib/supabase/drop-n8n-hearing-p-payload-migration.test.ts: ok');
