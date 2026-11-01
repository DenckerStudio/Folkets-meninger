import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261101140000_admin_analytics_overview.sql'),
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

const adminGetAnalyticsOverview = extractFunction('admin_get_analytics_overview');
assert.match(adminGetAnalyticsOverview, /SET search_path TO public, auth, pg_temp/i);
assert.match(
  adminGetAnalyticsOverview,
  /v_actor := public\.require_admin_user_id\(p_admin_user_id\)/,
);
assert.match(adminGetAnalyticsOverview, /occurred_at >= now\(\) - interval '30 days'/);
assert.match(adminGetAnalyticsOverview, /event_name = 'page_view'/);
assert.match(adminGetAnalyticsOverview, /count\(DISTINCT session_hash\)/);
assert.match(adminGetAnalyticsOverview, /event_name = 'poll_share_landing'/);
assert.match(adminGetAnalyticsOverview, /event_name = 'share_link_click'/);
assert.match(adminGetAnalyticsOverview, /metadata->>'bucket'/);
assert.match(adminGetAnalyticsOverview, /path LIKE '\/blogg%'/);
assert.match(adminGetAnalyticsOverview, /'pageViews', v_page_views/);
assert.match(adminGetAnalyticsOverview, /'topPaths', v_top_paths/);

assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.admin_get_analytics_overview\(uuid\) FROM PUBLIC, anon, authenticated/i,
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.admin_get_analytics_overview\(uuid\) TO service_role/i,
);

console.log('analytics/admin-overview-migration.test.ts: ok');
