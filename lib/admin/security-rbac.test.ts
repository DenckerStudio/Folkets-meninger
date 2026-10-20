import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261020110001_session_actor_and_rbac_hardening.sql'),
  'utf-8',
);

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.require_admin_user_id\(p_actor uuid\)/);
assert.match(
  migration,
  /FROM public\.user_roles[\s\S]*WHERE user_id = p_actor[\s\S]*AND role = 'admin'/,
);

assert.match(
  migration,
  /create_app_roadmap_item[\s\S]*v_actor := public\.require_admin_user_id\(p_admin_user_id\)/,
);
assert.match(
  migration,
  /grant_app_role[\s\S]*PERFORM public\.require_admin_user_id\(p_granted_by\)/,
);
assert.match(migration, /Missing granting admin/);

assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.create_app_roadmap_item\(uuid, text, text, text, integer\) TO service_role/,
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.grant_app_role\(uuid, text, uuid\) TO service_role/,
);
assert.doesNotMatch(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.create_app_roadmap_item[\s\S]*TO authenticated/,
);
assert.doesNotMatch(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.grant_app_role_by_email[\s\S]*TO authenticated/,
);

assert.match(migration, /RAISE EXCEPTION 'Admin required'/);

const gate = readFileSync(join(process.cwd(), 'lib/admin/gate.ts'), 'utf-8');
assert.doesNotMatch(gate, /app_metadata/);

const appFuture = readFileSync(join(process.cwd(), 'lib/admin/app-future.ts'), 'utf-8');
assert.match(appFuture, /p_admin_user_id: adminUserId/);
assert.match(appFuture, /getServiceSupabase/);

const roles = readFileSync(join(process.cwd(), 'lib/admin/roles.ts'), 'utf-8');
assert.match(roles, /p_granted_by: grantedBy/);

console.log('security-rbac.test.ts: ok');
