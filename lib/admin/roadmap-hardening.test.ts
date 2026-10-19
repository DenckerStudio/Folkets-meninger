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

assert.match(sessionActor, /require_admin_user_id\(p_admin_user_id\)/);
assert.match(sessionActor, /require_admin_user_id\(p_actor uuid\)/);

const appFuture = readFileSync(join(process.cwd(), 'lib/admin/app-future.ts'), 'utf-8');
assert.match(appFuture, /rpc\('update_app_roadmap_item'/);
assert.doesNotMatch(appFuture, /\.from\('app_roadmap_items'\)\s*\n\s*\.update/);

console.log('roadmap-hardening.test.ts: ok');
