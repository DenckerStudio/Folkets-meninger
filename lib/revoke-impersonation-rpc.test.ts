import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const hotfix = readFileSync(
  join(process.cwd(), 'supabase/hotfix/20261019_revoke_impersonation.sql'),
  'utf-8',
);
const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261020120001_revoke_impersonation_rpc_execute.sql'),
  'utf-8',
);

const mustRevoke = [
  'cast_vote',
  'get_user_vote_on_issue',
  'user_has_public_identity',
];

for (const fn of mustRevoke) {
  assert.match(hotfix, new RegExp(`'${fn}'`));
  assert.match(migration, new RegExp(`'${fn}'`));
}

assert.doesNotMatch(hotfix, /get_public_user_displays/);
assert.doesNotMatch(migration, /get_public_user_displays/);

console.log('revoke-impersonation-rpc.test.ts: ok');
