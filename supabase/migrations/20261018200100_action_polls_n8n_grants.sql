-- Ensure service_role can reach new aksjon tables + n8n RPCs (idempotent add-on).

BEGIN;

GRANT USAGE ON SCHEMA public TO service_role;

DO $$
DECLARE
  v_names text[] := ARRAY[
    'n8n_upsert_action_source',
    'n8n_upsert_action_cluster',
    'n8n_list_action_clusters_for_draft',
    'n8n_match_issues_by_embedding',
    'n8n_create_action_poll_draft',
    'n8n_purge_action_sources'
  ];
  v_name text;
  f regprocedure;
  n int;
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    n := 0;
    FOR f IN
      SELECT p.oid::regprocedure
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname = v_name
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
      n := n + 1;
    END LOOP;
    IF n = 0 THEN
      RAISE NOTICE 'Hopper over %: finnes ikke i public', v_name;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.action_clusters') IS NOT NULL THEN
    EXECUTE 'GRANT ALL ON public.action_clusters TO service_role';
  END IF;
  IF to_regclass('public.action_sources') IS NOT NULL THEN
    EXECUTE 'GRANT ALL ON public.action_sources TO service_role';
  END IF;
END $$;

COMMIT;
