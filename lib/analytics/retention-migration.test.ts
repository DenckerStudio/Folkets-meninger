import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANALYTICS_EVENTS_RETENTION_DAYS } from '@/lib/analytics/retention';

assert.equal(ANALYTICS_EVENTS_RETENTION_DAYS, 365);

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261122120000_analytics_events_retention.sql'),
  'utf-8',
);

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.purge_analytics_events_older_than/);
assert.match(migration, /DEFAULT 365/);
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION public\.purge_analytics_events_older_than\(int\) FROM PUBLIC, anon, authenticated/i,
);
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION public\.purge_analytics_events_older_than\(int\) TO service_role/i,
);
assert.match(migration, /SET search_path TO public, pg_temp/i);

console.log('lib/analytics/retention-migration.test.ts: ok');
