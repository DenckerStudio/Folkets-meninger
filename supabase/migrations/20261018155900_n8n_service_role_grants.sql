-- =============================================================================
-- n8n → service_role: KUN tilleggs-grants (ingen REVOKE). Idempotent.
--
-- Bakgrunn (prod-hendelse 18.10.2026, n8n TWTrqNYhvYcWz4UX exec 104757/104791):
--   20261018150000_security_lockdown_prod_safe.sql fjernet anon EXECUTE på
--   create_system_poll_draft. n8n-credential «Folkets Stemme Self-hosted»
--   (supabaseApi, DGPnXfRlXSdJG7RL) kaller PostgREST som anon (HTTP 401 + 42501),
--   så Reels-utkast feiler. Fiks: bytt credentialen til service_role-nøkkelen.
--
-- Denne migrasjonen sikrer at service_role har alt n8n trenger FØR nøkkelbyttet
-- (audit: qa/anon-lockdown-impact-2026-10-18.md). Den fjerner ingenting fra
-- anon/authenticated, så den er trygg å kjøre mens n8n fortsatt bruker anon.
--
-- Rekkefølge: sorterer før 20261018160000_security_lockdown_n8n.sql. 160000 skal
-- KUN kjøres etter at n8n-credentialen er byttet til service_role.
-- =============================================================================

BEGIN;

GRANT USAGE ON SCHEMA public TO service_role;

-- -----------------------------------------------------------------------------
-- 1. Påkrevd: create_system_poll_draft (alle overloads) — hard sjekk
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  f regprocedure;
  n int := 0;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.proname = 'create_system_poll_draft'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    n := n + 1;
  END LOOP;

  IF n = 0 THEN
    RAISE EXCEPTION 'public.create_system_poll_draft finnes ikke';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.proname = 'create_system_poll_draft'
      AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'service_role mangler EXECUTE på create_system_poll_draft etter GRANT';
  END IF;

  RAISE NOTICE 'create_system_poll_draft: % signatur(er) GRANT EXECUTE TO service_role', n;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Valgfrie RPC-er brukt av n8n (alle overloads). Mangler → NOTICE, ikke feil.
--    Første 8: kalt av n8n-workflows på DGPn (audit §1). Resten: listet i 160000.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_names text[] := ARRAY[
    'n8n_upsert_issue_ai_summary',
    'n8n_save_document_embedding',
    'n8n_list_issues_missing_ai_summary',
    'n8n_list_pending_document_chunks',
    'n8n_blocking_poll_for_issue',
    'n8n_list_saks_without_blocking_poll',
    'n8n_match_issue_document_chunks',
    'get_vote_totals_batch',
    'n8n_finalize_document_storage',
    'n8n_list_sak_for_system_poll',
    'n8n_log_ops_event',
    'n8n_pipeline_health',
    'n8n_get_issue_ai_summary_context'
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
    ELSE
      RAISE NOTICE '%: % signatur(er) GRANT EXECUTE TO service_role', v_name, n;
    END IF;
  END LOOP;

  -- Eventuelle andre n8n_*-funksjoner (samme mengde som 160000 låser til service_role)
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.proname LIKE 'n8n\_%' AND p.prokind IN ('f', 'p')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Tabeller/view brukt direkte via PostgREST av n8n på DGPn (audit §1).
--    PATCH med Prefer: return=representation krever SELECT i tillegg til UPDATE.
--    Mangler → NOTICE.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public.polls',                               'SELECT, UPDATE'), -- Read poll metadata, Save ratings, List draft polls
      ('public.stortinget_issue_documents',          'SELECT, UPDATE'), -- Clear document body storage (PATCH)
      ('public.stortinget_issues',                   'SELECT'),
      ('public.document_chunks',                     'SELECT'),
      ('public.issue_ai_summaries',                  'SELECT'),
      ('public.citizen_opinions',                    'SELECT'),
      ('public.hearing_comments',                    'SELECT'),
      ('public.notification_category_subscriptions', 'SELECT'),
      ('public.n8n_issues_missing_ai_summary',       'SELECT')          -- view (160000 låser til service_role)
    ) AS t(tbl, privs)
  LOOP
    IF to_regclass(r.tbl) IS NULL THEN
      RAISE NOTICE 'Hopper over %: finnes ikke', r.tbl;
      CONTINUE;
    END IF;
    EXECUTE format('GRANT %s ON %s TO service_role', r.privs, r.tbl);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4. RLS: service_role må ha BYPASSRLS (Supabase-standard). polls har kun en
--    SELECT-policy og ingen UPDATE-policy, så uten BYPASSRLS matcher PATCH 0 rader.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role' AND NOT rolbypassrls) THEN
    RAISE NOTICE 'ADVARSEL: service_role mangler BYPASSRLS — RLS på polls/stortinget_issue_documents vil blokkere n8n-PATCH';
  END IF;
  IF to_regclass('public.polls') IS NOT NULL
     AND NOT has_table_privilege('service_role', 'public.polls', 'UPDATE') THEN
    RAISE EXCEPTION 'service_role mangler UPDATE på public.polls etter GRANT';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
