import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261116200000_reddit_learning_stats.sql'),
  'utf-8',
);
const testSql = readFileSync(join(process.cwd(), 'supabase/tests/reddit_learning_stats.sql'), 'utf-8');

assert.match(migration, /CREATE OR REPLACE VIEW public\.reddit_learning_stats/);
assert.match(migration, /security_invoker\s*=\s*true/i);
assert.match(migration, /REVOKE ALL ON TABLE public\.reddit_learning_stats FROM PUBLIC/);
assert.match(migration, /REVOKE ALL ON TABLE public\.reddit_learning_stats FROM anon, authenticated/);
assert.match(migration, /GRANT SELECT ON TABLE public\.reddit_learning_stats TO service_role/);
assert.match(migration, /HAVING count\(\*\) >= 5/);
assert.match(migration, /effective_brukt/i);
assert.match(migration, /CREATE OR REPLACE VIEW public\.reddit_cluster_stats/);
assert.match(migration, /CREATE OR REPLACE VIEW public\.reddit_cluster_meta/);
assert.match(migration, /GRANT SELECT ON TABLE public\.reddit_cluster_stats TO service_role/);

assert.match(testSql, /has_table_privilege\('service_role', 'public\.reddit_learning_stats', 'SELECT'\)/);
assert.match(
  testSql,
  /has_table_privilege\('anon', 'public\.reddit_learning_stats', 'SELECT'\) THEN\s+RAISE EXCEPTION 'anon skal ikke ha SELECT/,
);

console.log('lib/reddit-signals/learning-stats-migration.test.ts: ok');