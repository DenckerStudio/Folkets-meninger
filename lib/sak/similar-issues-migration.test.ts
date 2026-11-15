import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const guard = readFileSync(join(process.cwd(), 'supabase/tests/security-guard.sql'), 'utf-8');
assert.match(guard, /'search_similar_stortinget_issues'/);

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261115120000_similar_stortinget_issues_embedding_v2.sql'),
  'utf-8',
);
assert.match(migration, /SECURITY DEFINER/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.search_similar_stortinget_issues/);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.search_similar_stortinget_issues\(text, int\) TO service_role/);

console.log('lib/sak/similar-issues-migration.test.ts: ok');