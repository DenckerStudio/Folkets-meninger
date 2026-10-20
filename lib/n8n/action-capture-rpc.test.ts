import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261021100000_action_capture_rpcs.sql'),
  'utf-8',
);

const guard = readFileSync(join(process.cwd(), 'supabase/tests/security-guard.sql'), 'utf-8');

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
  assert.match(guard, new RegExp(`'${fn}'`));
}

assert.match(migration, /SET search_path = public, pg_temp/i);
assert.match(migration, /NOTIFY pgrst, 'reload schema'/i);

const doc = readFileSync(
  join(process.cwd(), 'docs/n8n/action-capture-contract.md'),
  'utf-8',
);
assert.match(doc, /rpc\/upsert_action_capture/);
assert.match(doc, /Folkets Stemme Self-hosted/);

console.log('n8n/action-capture-rpc.test.ts: ok');
