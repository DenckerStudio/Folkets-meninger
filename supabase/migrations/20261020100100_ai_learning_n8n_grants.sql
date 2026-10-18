-- Idempotent service_role grants for ai_learning RPCs and tables.

BEGIN;

GRANT USAGE ON SCHEMA public TO service_role;

DO $$
DECLARE
  v_names text[] := ARRAY[
    'n8n_get_active_prompt',
    'n8n_list_prompt_candidates',
    'n8n_log_ai_generation',
    'n8n_propose_prompt_version',
    'n8n_list_eval_cases',
    'n8n_record_eval_run',
    'n8n_record_eval_result',
    'n8n_ai_weekly_metrics',
    'n8n_upsert_issue_ai_summary',
    'n8n_upsert_eval_case',
    'record_ai_feedback',
    'admin_poll_draft_action'
  ];
  v_name text;
  f regprocedure;
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    FOR f IN
      SELECT p.oid::regprocedure FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname = v_name
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
  END LOOP;
END $$;

COMMIT;
