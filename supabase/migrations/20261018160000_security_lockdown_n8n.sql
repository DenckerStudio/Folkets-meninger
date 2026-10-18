-- =============================================================================
-- n8n lockdown — kjør KUN når n8n-workflows bruker service_role (ikke anon).
-- Holdes separat fra 20261018150000 så prod kan låse app-API uten å knekke n8n.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_names text[] := ARRAY[
    'n8n_upsert_issue_ai_summary', 'n8n_save_document_embedding', 'n8n_finalize_document_storage',
    'n8n_list_pending_document_chunks', 'n8n_match_issue_document_chunks',
    'n8n_list_issues_missing_ai_summary', 'n8n_list_sak_for_system_poll', 'n8n_log_ops_event',
    'n8n_pipeline_health', 'n8n_get_issue_ai_summary_context'
  ];
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(v_names)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'n8n\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- Direkte PostgREST PATCH fra n8n (anon-nøkkel) — lukk når n8n er på service_role.
DO $$
BEGIN
  IF to_regclass('public.document_chunks') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.document_chunks FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT ON public.document_chunks TO anon, authenticated';
    EXECUTE 'GRANT ALL ON public.document_chunks TO service_role';
  END IF;
  IF to_regclass('public.stortinget_issue_documents') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.stortinget_issue_documents FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT ON public.stortinget_issue_documents TO anon, authenticated';
    EXECUTE 'GRANT ALL ON public.stortinget_issue_documents TO service_role';
  END IF;
END $$;

DO $$
DECLARE r record;
DECLARE v_path text;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig,
           (SELECT substring(c FROM 'search_path=(.*)') FROM unnest(p.proconfig) c
             WHERE c LIKE 'search_path=%') AS sp
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public' AND p.prosecdef AND d.objid IS NULL
      AND p.proname LIKE 'n8n\_%'
  LOOP
    IF r.sp IS NULL THEN
      v_path := 'public, extensions, pg_temp';
    ELSIF r.sp NOT LIKE '%pg_temp%' THEN
      v_path := r.sp || ', pg_temp';
    ELSE
      CONTINUE;
    END IF;
    EXECUTE format('ALTER FUNCTION %s SET search_path = %s', r.sig, v_path);
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.n8n_issues_missing_ai_summary') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.n8n_issues_missing_ai_summary SET (security_invoker = true)';
    EXECUTE 'REVOKE ALL ON public.n8n_issues_missing_ai_summary FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT ON public.n8n_issues_missing_ai_summary TO service_role';
  END IF;
END $$;

COMMIT;
