import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261122130000_analytics_http_errors.sql'),
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

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.analytics_http_daily/);
assert.match(
  migration,
  /ALTER TABLE public\.analytics_http_daily ENABLE ROW LEVEL SECURITY/i,
);
assert.match(
  migration,
  /REVOKE ALL ON TABLE public\.analytics_http_daily FROM PUBLIC, anon, authenticated/i,
);
assert.match(migration, /GRANT ALL ON TABLE public\.analytics_http_daily TO service_role/i);

const upsert = extractFunction('n8n_upsert_analytics_http_daily');
assert.match(upsert, /SET search_path TO public, pg_temp/i);

const adminHttp = extractFunction('admin_get_http_errors');
assert.match(adminHttp, /SET search_path TO public, auth, pg_temp/i);
assert.match(adminHttp, /v_actor := public\.require_admin_user_id\(p_admin_user_id\)/);
assert.match(adminHttp, /'top404'/);

const overview = extractFunction('admin_get_analytics_overview');
assert.match(overview, /event_name = 'http_error'/);
assert.match(overview, /'topAppErrors'/);

for (const { name, signature } of [
  { name: 'n8n_upsert_analytics_http_daily', signature: 'jsonb' },
  { name: 'admin_get_http_errors', signature: 'uuid, int' },
  { name: 'admin_get_analytics_overview', signature: 'uuid' },
]) {
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
}

console.log('lib/analytics/http-errors-migration.test.ts: ok');
