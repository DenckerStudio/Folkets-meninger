import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261116150000_delete_my_account.sql'),
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

const deleteMyAccount = extractFunction('delete_my_account');

assert.match(deleteMyAccount, /SECURITY DEFINER/);
assert.match(deleteMyAccount, /SET search_path = public, auth, extensions, pg_temp/i);
assert.match(deleteMyAccount, /PERFORM public\.assert_rpc_caller_is_user\(p_user_id\)/);
assert.match(deleteMyAccount, /PERFORM public\.purge_political_processing_data\(p_user_id\)/);
assert.match(deleteMyAccount, /DELETE FROM public\.admin_audit_log WHERE actor_id = p_user_id/);
assert.match(deleteMyAccount, /Cannot delete the last admin account/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.delete_my_account\(uuid\) FROM PUBLIC, anon, authenticated/);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.delete_my_account\(uuid\) TO service_role/);

console.log('lib/account-delete/delete-my-account-migration.test.ts: ok');