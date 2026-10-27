import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261027120000_system_poll_usable_embedding_gates.sql'),
  'utf-8',
);

const pollRpcs = [
  'n8n_list_sak_for_system_poll',
  'get_sak_poll_coverage',
  'get_sak_poll_candidates',
  'n8n_list_saks_without_blocking_poll',
];

for (const fn of pollRpcs) {
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

for (const fn of [
  'n8n_list_sak_for_system_poll',
  'get_sak_poll_coverage',
  'get_sak_poll_candidates',
  'n8n_list_saks_without_blocking_poll',
]) {
  assert.match(migration, new RegExp(`${fn}[\\s\\S]*?n8n_blocking_poll_id`, 'i'));
}

assert.doesNotMatch(
  migration,
  /embedding_status\s*=\s*'ready'[\s\S]*?AND\s+dc\.embedding\s+IS\s+NOT\s+NULL/i,
);

assert.match(migration, /fm_chunk_has_usable_embedding/g);

console.log('system-poll-embedding-gates.test.ts: ok');
