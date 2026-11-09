import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261109130000_research_topics_sak_poll.sql'),
  'utf8',
);

assert.match(migration, /stortinget_issue_id/i);
assert.match(migration, /stortinget_poll_id/i);
assert.doesNotMatch(migration, /GRANT.*anon/i);
assert.doesNotMatch(migration, /USING \(true\)/i);

console.log('lib/admin/research/topic-sak-poll-migration.test.ts: ok');
