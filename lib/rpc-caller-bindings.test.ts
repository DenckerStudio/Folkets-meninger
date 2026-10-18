import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261020120000_rpc_caller_user_binding.sql'),
  'utf-8',
);

const mustAssert = [
  'cast_vote',
  'cast_poll_vote',
  'get_user_poll_vote',
  'set_issue_stance',
  'create_citizen_opinion',
  'create_citizen_opinion_reply',
  'create_hearing_comment',
  'create_app_suggestion',
  'cast_app_suggestion_vote',
  'set_user_onboarding_state',
  'create_opinion_innspill',
  'endorse_opinion_innspill',
  'report_content',
  'record_political_consent',
  'withdraw_political_consent',
  'withdraw_all_political_consents',
  'purge_political_processing_data',
  'update_user_profile_names',
  'get_user_vote_on_issue',
  'get_user_vote_history',
];

for (const fn of mustAssert) {
  const re = new RegExp(
    `FUNCTION public\\.${fn}[\\s\\S]*?PERFORM public\\.assert_rpc_caller_is_user\\(`,
  );
  assert.match(migration, re, `missing assert bind on ${fn}`);
}

const serviceOnlySql = [
  'get_user_stance_on_issue',
  'get_user_stance_history',
  'get_user_stance_count',
  'get_user_stance_signals',
  'user_has_political_consent',
];

for (const fn of serviceOnlySql) {
  assert.match(migration, new RegExp(`'${fn}'`));
}

console.log('rpc-caller-bindings.test.ts: ok');
