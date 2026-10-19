import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261020150000_defense_in_depth_rpc_authz.sql'),
  'utf-8',
);

assert.match(
  migration,
  /coalesce\(auth\.role\(\), ''\) IS DISTINCT FROM 'service_role'/,
  'assert_rpc_caller_is_user must allow service_role and bind JWT callers',
);

assert.match(migration, /DROP FUNCTION IF EXISTS public\.cast_prompt_vote/);
assert.match(migration, /DROP FUNCTION IF EXISTS public\.suggest_trusted_news_source/);

for (const fn of [
  'promote_citizen_initiative_to_poll',
  'get_user_stance_on_issue',
  'user_has_political_consent',
]) {
  const re = new RegExp(
    `FUNCTION public\\.${fn}[\\s\\S]*?PERFORM public\\.assert_rpc_caller_is_(user|actor)\\(`,
  );
  assert.match(migration, re, `missing caller guard on ${fn}`);
}

assert.match(migration, /greatest\(coalesce\(p_min_votes, 10\), 10\)/);
assert.match(migration, /No email, subscription, or avatar/);

console.log('defense-in-depth-authz.test.ts: ok');
