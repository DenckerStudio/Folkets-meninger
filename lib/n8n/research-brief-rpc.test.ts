import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261021130000_research_briefs.sql'),
  'utf-8',
);

const serviceRoleFns = [
  'n8n_upsert_research_brief',
  'n8n_set_research_output',
  'n8n_get_research_brief',
  'n8n_create_research_reel_draft',
  'research_briefs_expire_stale',
];

for (const fn of serviceRoleFns) {
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

assert.match(migration, /details jsonb NOT NULL DEFAULT '\{\}'::jsonb/i);
assert.match(migration, /p_details jsonb DEFAULT NULL/i);
assert.match(migration, /research_briefs_validate_perspectives/i);
assert.match(migration, /research_briefs_is_backwards_status/i);
assert.match(migration, /COALESCE\(p_summary, summary\)/i);
assert.match(migration, /COALESCE\(p_perspectives, perspectives\)/i);
assert.match(migration, /FOR UPDATE/i);
assert.match(migration, /error = 'tidsavbrudd'/i);
assert.match(migration, /'origin', 'research'/i);
assert.match(migration, /create_system_poll_draft/i);
assert.match(migration, /research_briefs_one_active_per_cluster_kind_idx/i);
assert.match(migration, /research_briefs_assert_field_sizes/i);
assert.match(migration, /IF v_row\.status IN \('done', 'failed'\)/i);
assert.match(migration, /research_brief_failed/i);
assert.match(migration, /research_request_conflict/i);
assert.match(migration, /research_brief_active/i);
assert.match(migration, /research_invalid_input/i);
assert.match(migration, /research_briefs_enqueue/i);
assert.match(migration, /research_briefs_normalize_generation_metadata/i);
assert.match(migration, /research_briefs_normalize_error/i);
assert.match(migration, /research_briefs_validate_reel_source_urls/i);
assert.match(migration, /updated_at < now\(\) - make_interval/i);
assert.match(migration, /n8n_get_research_brief[\s\S]*?RETURN NULL;/i);
assert.match(migration, /'poll_id', v_poll_id,\s*\n\s*'created', true/i);

assert.match(
  migration,
  /n8n_upsert_research_brief\(uuid, text, text, jsonb, jsonb, jsonb, text, uuid, text\)/i,
);

assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
assert.match(migration, /REVOKE ALL ON TABLE public.research_briefs FROM PUBLIC, anon, authenticated/i);
assert.match(migration, /NOTIFY pgrst, 'reload schema'/i);

const doc = readFileSync(
  join(process.cwd(), 'docs/n8n/research-webhook-contract.md'),
  'utf-8',
);
assert.match(doc, /N8N_RESEARCH_WEBHOOK_BASE/);
assert.match(doc, /N8N_RESEARCH_WEBHOOK_TOKEN/);
assert.match(doc, /X-FM-Webhook-Token/);
assert.match(doc, /n8n_get_research_brief/);
assert.match(doc, /n8n_create_research_reel_draft/);
assert.match(doc, /research_briefs_expire_stale/);
assert.match(doc, /independent/);
assert.match(doc, /snapshot/i);
assert.match(doc, /source_request_id/);
assert.match(doc, /arbeidsflyt_utilgjengelig/);
assert.match(doc, /"poll_id".*"created"/i);
assert.match(doc, /source_event.*research:/i);
assert.match(doc, /review_note/);
assert.match(doc, /"label": "NRK"/);
assert.match(doc, /webhook_http_/);
assert.match(doc, /minst hvert 20\. minutt/i);
assert.match(doc, /research_brief_failed/);
assert.match(doc, /research_invalid_input/);

const webhook = readFileSync(
  join(process.cwd(), 'lib/admin/research/webhook.ts'),
  'utf-8',
);
assert.match(webhook, /N8N_RESEARCH_WEBHOOK_TOKEN/);
assert.match(webhook, /X-FM-Webhook-Token/);

const service = readFileSync(
  join(process.cwd(), 'lib/admin/research/service.ts'),
  'utf-8',
);
assert.match(service, /research_briefs_expire_stale/);
const listClusterBriefsBody =
  service.split('export async function listResearchBriefsForCluster')[1]?.split(
    'export async function buildResearchWebhookBody',
  )[0] ?? '';
assert.equal(listClusterBriefsBody.includes('expireStaleResearchBriefs'), false);
assert.match(service, /research_briefs_enqueue/);
assert.match(service, /research_request_conflict/);
assert.match(service, /research_brief_active/);
assert.match(service, /source_request_id/);
assert.match(service, /getLatestDoneDeepenRequestIdForCluster/);
assert.match(service, /arbeidsflyt_utilgjengelig/);

console.log('n8n/research-brief-rpc.test.ts: ok');
