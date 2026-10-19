-- =============================================================================
-- n8n_* RPC lockdown: anon/authenticated ut, service_role inn. Idempotent.
--
-- Funn prod 19.10.2026 (supabase.heyklever.app): offentlig anon-nøkkel kunne kalle
-- n8n_pipeline_health, n8n_list_sak_for_system_poll og n8n_log_ops_event (skrev
-- testrad ea414ca8-ba3e-4bd6-a460-9898cf7d6d14 i public.n8n_ops_events).
--
-- !!! IKKE KJØR før n8n-credential DGPnXfRlXSdJG7RL («Folkets Stemme Self-hosted»)
-- !!! er bekreftet på service_role-nøkkelen. Ellers slutter AI-oppsummeringer,
-- !!! embeddings, pipeline-helse og Reels-poll å virke.
--
-- Forutsetter 20261018155900_n8n_service_role_grants.sql (additive grants).
-- Funksjonsdelen av 20261018160000_security_lockdown_n8n.sql dekkes også her.
-- 160000 sin tabell-/view-/search_path-del dekkes IKKE her.
-- =============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- 1. REVOKE ALL fra PUBLIC/anon/authenticated + GRANT EXECUTE til service_role
--    for hver public.n8n_%-signatur (unntatt extension-eide).
DO $$
DECLARE
  r record;
  v_kw text;
  n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.prokind
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE ns.nspname = 'public'
      AND p.proname LIKE 'n8n\_%'
      AND d.objid IS NULL
  LOOP
    v_kw := CASE WHEN r.prokind = 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END;
    EXECUTE format('REVOKE ALL ON %s %s FROM PUBLIC, anon, authenticated', v_kw, r.sig);
    EXECUTE format('GRANT EXECUTE ON %s %s TO service_role', v_kw, r.sig);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'n8n_*-lockdown: % signatur(er) låst til service_role', n;
END $$;

-- 2. Fjern testraden fra sikkerhetsfunnet (n8n_log_ops_event skriver til public.n8n_ops_events)
DO $$
DECLARE
  v_deleted int;
BEGIN
  IF to_regclass('public.n8n_ops_events') IS NULL THEN
    RAISE NOTICE 'public.n8n_ops_events finnes ikke; hopper over sletting av testrad';
    RETURN;
  END IF;
  DELETE FROM public.n8n_ops_events WHERE id = 'ea414ca8-ba3e-4bd6-a460-9898cf7d6d14'::uuid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'Slettet % testrad(er) fra public.n8n_ops_events', v_deleted;
END $$;

-- 3. Assertion: ingen n8n_*-signatur kjørbar for anon/authenticated; alle for service_role
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(
           format('%s (anon=%s, authenticated=%s, service_role=%s)',
                  p.oid::regprocedure,
                  has_function_privilege('anon', p.oid, 'EXECUTE'),
                  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
                  has_function_privilege('service_role', p.oid, 'EXECUTE')),
           '; ')
    INTO v_bad
  FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid = p.pronamespace
  LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
  WHERE ns.nspname = 'public'
    AND p.proname LIKE 'n8n\_%'
    AND d.objid IS NULL
    AND (has_function_privilege('anon', p.oid, 'EXECUTE')
         OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
         OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE'));

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'n8n_*-lockdown feilet: %', v_bad;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
