import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261020110000_roadmap_write_hardening.sql'),
  'utf-8',
);

assert.match(migration, /update_app_roadmap_item/);
assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.app_roadmap_items/);

const sessionActor = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261020110001_session_actor_and_rbac_hardening.sql'),
  'utf-8',
);

assert.match(sessionActor, /app_future_require_admin\(\)/);
assert.doesNotMatch(sessionActor, /app_future_require_admin\(p_admin_user_id/);
assert.match(sessionActor, /auth\.uid\(\)/);
assert.match(sessionActor, /public\.is_admin\(\)/);
assert.match(sessionActor, /create_app_roadmap_item\(\s*\n\s*p_title text/);
assert.doesNotMatch(sessionActor, /p_admin_user_id uuid/);
assert.match(sessionActor, /GRANT EXECUTE ON FUNCTION public\.create_app_roadmap_item\(text, text, text, integer\) TO authenticated/);
assert.match(sessionActor, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.n8n_issues_missing_ai_summary/);
assert.match(sessionActor, /IF NOT public\.is_admin\(\) THEN[\s\S]*grant_app_role/);

const appFuture = readFileSync(join(process.cwd(), 'lib/admin/app-future.ts'), 'utf-8');
assert.match(appFuture, /getServerSupabase/);
assert.match(appFuture, /rpc\('update_app_roadmap_item'/);
assert.doesNotMatch(appFuture, /p_admin_user_id/);
assert.doesNotMatch(appFuture, /\.from\('app_roadmap_items'\)\s*\n\s*\.update/);

const roles = readFileSync(join(process.cwd(), 'lib/admin/roles.ts'), 'utf-8');
assert.match(roles, /getServerSupabase/);
assert.doesNotMatch(roles, /p_granted_by/);

const gate = readFileSync(join(process.cwd(), 'lib/admin/gate.ts'), 'utf-8');
assert.doesNotMatch(gate, /app_metadata/);

console.log('roadmap-hardening.test.ts: ok');
