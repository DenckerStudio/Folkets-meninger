-- =============================================================================
-- create_system_poll_draft: eksplisitt EXECUTE for service_role (idempotent).
--
-- Bakgrunn (prod-hendelse 18.10.2026, n8n TWTrqNYhvYcWz4UX exec 104757):
--   20261018150000_security_lockdown_prod_safe.sql fjernet EXECUTE fra anon/authenticated
--   på alle ikke-n8n_*-funksjoner, inkl. create_system_poll_draft. Funksjonen har aldri hatt
--   en eksplisitt anon-grant (20260821130000 ga kun service_role); anon kunne kalle den bare
--   via Supabase sine default privileges. n8n-credentialen kaller PostgREST med anon-rolle
--   (HTTP 401 + 42501 = ikke-autentisert/anon i PostgREST), og fikk derfor permission denied.
--
-- Denne migrasjonen:
--   * holder anon/authenticated UTE (samme mønster som 20260821130000 og 150000),
--   * sikrer GRANT EXECUTE TO service_role på ALLE overloads (pg_proc), i tilfelle
--     signaturen er endret/duplisert i prod,
--   * feiler hvis funksjonen mangler eller service_role ikke får EXECUTE.
--
-- Selve n8n-feilen løses ved at n8n-credential «Folkets Stemme Self-hosted»
-- (supabaseApi, id DGPnXfRlXSdJG7RL) bruker service_role-nøkkelen i stedet for anon-nøkkelen.
-- Vi gir IKKE anon EXECUTE (SECURITY DEFINER-funksjon som oppretter poll-utkast).
-- =============================================================================

BEGIN;

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
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
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

  RAISE NOTICE 'create_system_poll_draft: % signatur(er) låst til service_role', n;
END $$;

-- PostgREST: oppdater schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
