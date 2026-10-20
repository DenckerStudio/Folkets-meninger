import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrations = [
  '20261021100000_action_capture_rpcs.sql',
  '20261021110000_action_capture_atomic.sql',
].map((name) => readFileSync(join(process.cwd(), 'supabase/migrations', name), 'utf-8'));

const guard = readFileSync(join(process.cwd(), 'supabase/tests/security-guard.sql'), 'utf-8');

for (const migration of migrations) {
  for (const fn of ['upsert_action_capture', 'set_action_cluster_verdict']) {
    assert.match(migration, new RegExp(`FUNCTION public\\.${fn}`, 'i'));
    assert.match(
      migration,
      new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${fn}[\\s\\S]*?FROM PUBLIC, anon, authenticated`,
        'i',
      ),
    );
    assert.match(
      migration,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]*?TO service_role`, 'i'),
    );
  }
  assert.match(migration, /SET search_path = public, pg_temp/i);
}

const atomicMigration = migrations[1];
assert.match(atomicMigration, /RAISE EXCEPTION[\s\S]*ERRCODE = '22023'/i);
assert.match(guard, /'upsert_action_capture'/);
assert.match(guard, /'set_action_cluster_verdict'/);
assert.match(migrations[0], /NOTIFY pgrst, 'reload schema'/i);
assert.match(atomicMigration, /NOTIFY pgrst, 'reload schema'/i);

const doc = readFileSync(
  join(process.cwd(), 'docs/n8n/action-capture-contract.md'),
  'utf-8',
);
assert.match(doc, /rpc\/upsert_action_capture/);
assert.match(doc, /Folkets Stemme Self-hosted/);
assert.match(doc, /SQLSTATE.*22023/i);
assert.match(doc, /HTTP 400/i);

console.log('n8n/action-capture-rpc.test.ts: ok');
