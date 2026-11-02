import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261102180000_admin_users.sql'),
  'utf-8',
);

function extractFunction(name: string): string {
  const re = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}[\\s\\S]*?\\$function\\$;`,
    'i',
  );
  const m = migration.match(re);
  assert.ok(m, `missing function ${name}`);
  return m[0];
}

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.admin_audit_log/);
assert.match(
  migration,
  /ALTER TABLE public\.admin_audit_log ENABLE ROW LEVEL SECURITY/i,
);

const listUsers = extractFunction('admin_list_users');
assert.match(listUsers, /SET search_path TO public, auth, pg_temp/i);
assert.match(listUsers, /v_actor := public\.require_admin_user_id\(p_admin_user_id\)/);

const anonymize = extractFunction('admin_anonymize_user');
assert.match(anonymize, /first_name = 'Slettet'/);

const assertMutation = extractFunction('admin_assert_user_mutation_allowed');
assert.match(assertMutation, /Cannot modify self/);
assert.match(assertMutation, /Cannot revoke the last admin/);

console.log('lib/admin/users-migration.test.ts: ok');
