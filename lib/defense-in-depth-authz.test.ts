import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261021160000_defense_in_depth_rpc_authz.sql'),
  'utf-8',
);

assert.match(migration, /rpc_caller_is_trusted_server/);
assert.match(
  migration,
  /session_user::text IN \('postgres', 'supabase_admin', 'service_role'\)/,
);
assert.match(
  migration,
  /RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'/,
  'forbidden must map to HTTP 403',
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

const hardenedFunctions = [
  'get_public_user_displays',
  'get_poll_totals_by_fylke',
  'user_has_political_consent',
  'get_user_stance_on_issue',
  'get_user_stance_history',
  'get_user_stance_count',
  'get_user_stance_signals',
  'promote_citizen_initiative_to_poll',
];

for (const fn of hardenedFunctions) {
  const re = new RegExp(
    `FUNCTION public\\.${fn}[\\s\\S]*?SET search_path = public, pg_temp`,
  );
  assert.match(migration, re, `${fn} must use hardened search_path`);
}

assert.match(migration, /greatest\(coalesce\(p_min_votes, 10\), 10\)/);
assert.match(migration, /No email, subscription, or avatar/);

console.log('defense-in-depth-authz.test.ts: ok');
