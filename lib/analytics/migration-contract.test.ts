import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261101120000_analytics_share_links.sql'),
  'utf-8',
);

const tables = ['share_links', 'analytics_events'];

for (const table of tables) {
  assert.match(
    migration,
    new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'),
  );
  assert.match(
    migration,
    new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated`, 'i'),
  );
}

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.share_links/);
assert.match(migration, /target_kind IN \('poll', 'blog_post', 'sak', 'generic'\)/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.analytics_events/);
assert.match(migration, /event_name = 'share_link_click'/);

assert.match(
  migration,
  /admin_get_user_metrics[\s\S]*v_actor := public\.require_admin_user_id\(p_admin_user_id\)/,
);
assert.match(
  migration,
  /admin_get_share_link_stats[\s\S]*v_actor := public\.require_admin_user_id\(p_admin_user_id\)/,
);

const serviceRoleFunctions: Array<{ name: string; signature: string }> = [
  { name: 'insert_analytics_event', signature: 'jsonb' },
  { name: 'admin_get_user_metrics', signature: 'uuid' },
  { name: 'admin_get_share_link_stats', signature: 'uuid, int' },
];

for (const { name, signature } of serviceRoleFunctions) {
  assert.match(migration, new RegExp(`FUNCTION public\\.${name}`, 'i'));
  assert.match(
    migration,
    new RegExp(
      `REVOKE ALL ON FUNCTION public\\.${name}\\(${signature.replace(/,/g, ',\\s*')}\\) FROM PUBLIC, anon, authenticated`,
      'i',
    ),
  );
  assert.match(
    migration,
    new RegExp(
      `GRANT EXECUTE ON FUNCTION public\\.${name}\\(${signature.replace(/,/g, ',\\s*')}\\) TO service_role`,
      'i',
    ),
  );
  assert.doesNotMatch(
    migration,
    new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}[\\s\\S]*TO authenticated`, 'i'),
  );
}

assert.match(migration, /subscription_tier = 'stemme_plus'/);
assert.match(migration, /stemmePlus', v_stemme_plus/);

console.log('analytics/migration-contract.test.ts: ok');
