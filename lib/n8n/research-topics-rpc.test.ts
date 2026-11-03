import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261103120000_research_topics.sql'),
  'utf8',
);

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.research_topics/);
assert.match(migration, /previous_output jsonb/i);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.n8n_get_research_topic/i);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.n8n_upsert_research_topic_brief/i);
assert.doesNotMatch(migration, /research_topic_briefs/i);
assert.doesNotMatch(migration, /n8n_set_topic_brief_output/i);
assert.doesNotMatch(migration, /n8n_upsert_topic_brief/i);

const contract = readFileSync(
  join(process.cwd(), 'docs/n8n/research-webhook-contract.md'),
  'utf8',
);
assert.match(contract, /folkets-research-topic-brief/);
assert.match(contract, /n8n_get_research_topic/);
assert.match(migration, /WHEN 'henting_feil' THEN 'henting_feil'/);
assert.match(migration, /WHEN 'tema_mangler' THEN 'tema_mangler'/);
assert.match(migration, /'code', 'unknown_request'/);
assert.match(migration, /'code', 'not_found'/);
assert.match(migration, /'code', 'invalid_status'/);
assert.match(migration, /'ok', true,[\s\S]*'topic'/);
assert.match(contract, /n8n_upsert_research_topic_brief/);

const errorMessages = readFileSync(
  join(process.cwd(), 'lib/admin/research/topic-error-messages.ts'),
  'utf8',
);
assert.match(errorMessages, /henting_feil/);
assert.match(errorMessages, /tema_mangler/);
assert.match(errorMessages, /researchTopicBriefErrorAllowsRetry/);

console.log('lib/n8n/research-topics-rpc.test.ts: ok');
