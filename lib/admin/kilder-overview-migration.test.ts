import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261115183000_admin_kilder_embeddings_overview.sql'),
  'utf-8',
);

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_get_kilde_overview\(p_admin_user_id uuid\)/i);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_get_embedding_coverage\(p_admin_user_id uuid\)/i);
assert.match(migration, /v_actor := public\.require_admin_user_id\(p_admin_user_id\)/);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.admin_get_kilde_overview\(uuid\) TO service_role/i);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.admin_get_embedding_coverage\(uuid\) TO service_role/i);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_get_kilde_overview\(uuid\) FROM PUBLIC, anon, authenticated/i);
assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.admin_get_kilde_overview[\s\S]*TO authenticated/i);

console.log('lib/admin/kilder-overview-migration.test.ts: ok');