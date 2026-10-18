import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const servicePath = join(process.cwd(), 'lib/polls/service.ts');
const migrationPath = join(process.cwd(), 'supabase/migrations/20261018200000_action_polls.sql');

const serviceSource = readFileSync(servicePath, 'utf-8');
const migrationSource = readFileSync(migrationPath, 'utf-8');

assert.match(serviceSource, /listOpenSystemPolls[\s\S]*?\.neq\('poll_kind', 'aksjon'\)/);
assert.match(serviceSource, /listSystemPollDrafts[\s\S]*?\.neq\('poll_kind', 'aksjon'\)/);
assert.match(serviceSource, /listOpenPolls[\s\S]*?\.neq\('poll_kind', 'aksjon'\)/);
assert.match(serviceSource, /listOpenActionPolls[\s\S]*?\.eq\('poll_kind', 'aksjon'\)/);

assert.match(migrationSource, /n8n_create_action_poll_draft/);
assert.match(migrationSource, /daily_cap_reached/);
assert.match(migrationSource, /cluster_blocked/);
assert.match(migrationSource, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/);
assert.match(migrationSource, /poll_kind text NOT NULL DEFAULT 'sak'/);

console.log('action-polls-filter.test.ts: ok');
