import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261021130000_research_briefs.sql'),
  'utf-8',
);

for (const fn of ['n8n_upsert_research_brief', 'n8n_set_research_output']) {
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
    new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}[\\s\\S]*?TO service_role`, 'i',
    ),
  );
}

assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
assert.match(migration, /REVOKE ALL ON TABLE public.research_briefs FROM PUBLIC, anon, authenticated/i);
assert.match(migration, /NOTIFY pgrst, 'reload schema'/i);

const doc = readFileSync(
  join(process.cwd(), 'docs/n8n/research-webhook-contract.md'),
  'utf-8',
);
assert.match(doc, /N8N_RESEARCH_WEBHOOK_BASE/);
assert.match(doc, /n8n_upsert_research_brief/);

console.log('n8n/research-brief-rpc.test.ts: ok');
