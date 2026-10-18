-- Idempotent re-apply of RPC EXECUTE lockdown after 20261018150000 (re-grants authenticated allowlist).
-- Prod: safe when supabase/hotfix/20261019_revoke_impersonation.sql was already applied manually.
-- CI: run-prod-like-db-security.sh applies this after 150000.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  f regprocedure;
  v_name text;
  v_names text[] := ARRAY[
    'cast_app_suggestion_vote',
    'cast_poll_vote',
    'cast_vote',
    'create_app_suggestion',
    'create_citizen_opinion',
    'create_citizen_opinion_reply',
    'create_hearing_comment',
    'create_opinion_innspill',
    'endorse_opinion_innspill',
    'get_user_poll_vote',
    'get_user_stance_count',
    'get_user_stance_history',
    'get_user_stance_on_issue',
    'get_user_stance_signals',
    'get_user_vote_history',
    'get_user_vote_on_issue',
    'record_political_consent',
    'report_content',
    'set_issue_stance',
    'set_user_onboarding_state',
    'update_user_profile_names',
    'user_has_political_consent',
    'user_has_public_identity',
    'withdraw_all_political_consents',
    'withdraw_political_consent',
    'purge_political_processing_data'
  ];
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    FOR f IN
      SELECT p.oid::regprocedure
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE
  f regprocedure;
  v_name text;
  v_names text[] := ARRAY[
    'get_user_stance_on_issue',
    'get_user_stance_history',
    'get_user_stance_count',
    'get_user_stance_signals',
    'user_has_political_consent'
  ];
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    FOR f IN
      SELECT p.oid::regprocedure
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
