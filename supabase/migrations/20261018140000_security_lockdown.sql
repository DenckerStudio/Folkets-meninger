-- =============================================================================
-- Sikkerhetslåsing etter revisjon 18.10.2026 (supabase/migrations/20261018140000_security_lockdown.sql).
-- Sikkerhetsrevisjon 18.10.2026 (Folkets Meninger).
--
-- Koder inn hendelsesfiksen fra 17.–18.10.2026 (user_roles + grant/revoke_app_role)
-- og lukker databasefunnene i rapport.md:
--   1. RLS på alle tabeller i public (inkl. app_roles), tabell-DML for anon/authenticated
--      fjernes og gis tilbake bare der appen trenger det.
--   2. REVOKE EXECUTE fra PUBLIC/anon/authenticated på ALLE funksjoner i public/private,
--      deretter GRANT bare på en eksplisitt allowlist (lesing av offentlige aggregater).
--   3. ALTER DEFAULT PRIVILEGES så nye funksjoner/tabeller ikke blir åpne automatisk.
--   4. search_path herdes på SECURITY DEFINER-funksjoner (pg_temp sist).
--   5. View med security_invoker.
--   6. Audit-skjema + triggere på user_roles, app_roles og auth.users.raw_app_meta_data,
--      med pg_notify for varsling.
--
-- FØR KJØRING:
--   * Kjør verify-queries.sql først og lagre resultatet (før/etter-sammenligning).
--   * Test på en staging-kopi / Supabase-branch. Kjør i én transaksjon.
--   * Sjekk at n8n bruker service_role-nøkkelen (n8n_* RPC-ene blir service_role-only).
--   * Seksjon 3 (default privileges for supabase_admin) krever superuser; feiler stille
--     med NOTICE hvis rollen mangler rettighet.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Audit-skjema (opprettes først så triggere kan logge resten av migrasjonen)
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS audit;
REVOKE ALL ON SCHEMA audit FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA audit TO service_role;

CREATE TABLE IF NOT EXISTS audit.security_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  table_name  text        NOT NULL,
  operation   text        NOT NULL,
  target_id   text,
  old_data    jsonb,
  new_data    jsonb,
  db_user     text        NOT NULL DEFAULT current_user,
  session_user_name text  NOT NULL DEFAULT session_user,
  jwt_role    text,
  jwt_sub     text,
  client_addr inet        DEFAULT inet_client_addr(),
  app_name    text        DEFAULT current_setting('application_name', true)
);
ALTER TABLE audit.security_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON audit.security_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON audit.security_events TO service_role;
-- Ingen UPDATE/DELETE for noen app-rolle: append-only.

CREATE OR REPLACE FUNCTION audit.log_security_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_old jsonb;
  v_new jsonb;
  v_target text;
BEGIN
  IF TG_TABLE_SCHEMA = 'auth' AND TG_TABLE_NAME = 'users' THEN
    -- Logg bare app_metadata (ikke passord-hash e.l.).
    v_old := jsonb_build_object('raw_app_meta_data', OLD.raw_app_meta_data);
    v_new := jsonb_build_object('raw_app_meta_data', NEW.raw_app_meta_data);
    v_target := NEW.id::text;
  ELSIF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'users' THEN
    v_old := jsonb_build_object('subscription_tier', OLD.subscription_tier, 'subscription_status', OLD.subscription_status);
    v_new := jsonb_build_object('subscription_tier', NEW.subscription_tier, 'subscription_status', NEW.subscription_status);
    v_target := NEW.id::text;
  ELSE
    v_old := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END;
    v_new := CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN to_jsonb(NEW) END;
    v_target := coalesce(v_new->>'user_id', v_old->>'user_id', v_new->>'role', v_old->>'role');
  END IF;

  INSERT INTO audit.security_events
    (table_name, operation, target_id, old_data, new_data, jwt_role, jwt_sub)
  VALUES
    (TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, TG_OP, v_target, v_old, v_new,
     v_claims->>'role', v_claims->>'sub');

  -- Varsling: n8n «Postgres Trigger»-node (LISTEN security_events) eller annen lytter.
  PERFORM pg_notify('security_events', json_build_object(
    'table', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    'op', TG_OP,
    'target', v_target,
    'jwt_role', v_claims->>'role',
    'jwt_sub', v_claims->>'sub',
    'db_user', current_user,
    'at', now()
  )::text);

  RETURN coalesce(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION audit.log_security_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION audit.log_security_event();

DROP TRIGGER IF EXISTS trg_audit_app_roles ON public.app_roles;
CREATE TRIGGER trg_audit_app_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.app_roles
  FOR EACH ROW EXECUTE FUNCTION audit.log_security_event();

-- auth.users eies av supabase_auth_admin; krever at migrasjonen kjøres som en rolle med
-- rett til å lage triggere på auth.users (postgres/supabase_admin på self-hosted).
DROP TRIGGER IF EXISTS trg_audit_auth_app_metadata ON auth.users;
CREATE TRIGGER trg_audit_auth_app_metadata
  AFTER UPDATE OF raw_app_meta_data ON auth.users
  FOR EACH ROW
  WHEN (OLD.raw_app_meta_data IS DISTINCT FROM NEW.raw_app_meta_data)
  EXECUTE FUNCTION audit.log_security_event();

-- Abonnement/Stemme+ (endret av åpne RPC-er i dag): logg endringer i tier.
DROP TRIGGER IF EXISTS trg_audit_users_subscription ON public.users;
CREATE TRIGGER trg_audit_users_subscription
  AFTER UPDATE OF subscription_tier, subscription_status ON public.users
  FOR EACH ROW
  WHEN (OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier
        OR OLD.subscription_status IS DISTINCT FROM NEW.subscription_status)
  EXECUTE FUNCTION audit.log_security_event();

-- -----------------------------------------------------------------------------
-- 1. Hendelsesfiksen kodet inn: user_roles / app_roles / rollefunksjoner
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;          -- RLS: egen rad / admin
GRANT ALL    ON TABLE public.user_roles TO service_role;

-- app_roles hadde INGEN RLS i repoet og anon har DML i prod.
-- DELETE FROM app_roles WHERE role='admin' kaskaderer og sletter alle admin-rader i user_roles.
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_roles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_roles FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.app_roles TO service_role;
-- Fjern kaskade-sletting av roller (rolle-sletting skal være eksplisitt).
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_fkey;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_fkey FOREIGN KEY (role)
  REFERENCES public.app_roles (role) ON UPDATE RESTRICT ON DELETE RESTRICT;

-- Rollefunksjoner: kun service_role (det appen bruker via /api/admin/roles).
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('grant_app_role','grant_app_role_by_email','revoke_app_role',
                        'revoke_app_role_by_email','sync_user_admin_metadata','list_app_admins',
                        'grant_stemme_plus','grant_stemme_plus_by_email','revoke_stemme_plus',
                        'revoke_stemme_plus_by_email','list_stemme_plus_supporters',
                        'app_future_require_admin')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Funksjoner: lukk alt, åpne en allowlist
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'   -- hopp over extension-funksjoner
    WHERE n.nspname IN ('public', 'private')
      AND d.objid IS NULL
      AND p.prokind IN ('f', 'p')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- Allowlist (brukt av anon-/session-klienten i appen, kun lesing av offentlige data):
--   lib/identity/public-user-display.ts, lib/blog/related-context.ts, lib/chat/vote-alignment.ts,
--   lib/polls/service.ts (resolvePollReadClient → anon), lib/chat/vector-search.ts (session).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_public_user_displays', 'get_issue_vote_totals',
                        'get_poll_totals', 'get_poll_totals_by_fylke',
                        'match_issue_document_chunks')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
  END LOOP;
END $$;
-- is_admin() brukes i RLS-policies (user_roles_select_admin, n8n_ops_events_admin_read).
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Default privileges: nye objekter skal være lukket som standard
-- -----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM anon, authenticated;
-- NB: PUBLIC-EXECUTE er en GLOBAL standard i Postgres; den kan bare fjernes uten «IN SCHEMA».
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $$
BEGIN
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated';
EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
  RAISE NOTICE 'Kunne ikke endre default privileges for supabase_admin (%). Kjør som superuser.', SQLERRM;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Tabeller: RLS overalt, fjern anon/authenticated-DML, gi tilbake det appen trenger
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS tbl
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE %s FROM PUBLIC, anon, authenticated', r.tbl);
  END LOOP;
END $$;

-- Skriving via session-klient (RLS-policies finnes allerede, se rapport H-6):
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_llm_credentials           TO authenticated; -- lib/byok/service.ts
GRANT SELECT, UPDATE                 ON public.notifications                  TO authenticated; -- app/api/notifications/route.ts
GRANT SELECT, INSERT, UPDATE         ON public.notification_preferences       TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.notification_category_subscriptions TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.notification_label_subscriptions    TO authenticated;

-- Ingen klient skal skrive identity_verified selv (WITH CHECK på egen rad).
DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;
CREATE POLICY user_profiles_update_own ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Appens fremtid: changelog/roadmap var skrivbare for authenticated i prod (kun service_role skal skrive).
DROP POLICY IF EXISTS app_changelog_entries_authenticated_write ON public.app_changelog_entries;
DROP POLICY IF EXISTS app_roadmap_items_authenticated_write ON public.app_roadmap_items;
REVOKE INSERT, UPDATE, DELETE ON public.app_changelog_entries FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.app_roadmap_items FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS app_changelog_entries_select_published ON public.app_changelog_entries;
CREATE POLICY app_changelog_entries_select_published ON public.app_changelog_entries
  FOR SELECT TO anon, authenticated
  USING (published_at <= now());
GRANT SELECT ON public.app_changelog_entries TO anon, authenticated;
DROP POLICY IF EXISTS app_roadmap_items_select_public ON public.app_roadmap_items;
CREATE POLICY app_roadmap_items_select_public ON public.app_roadmap_items
  FOR SELECT TO anon, authenticated
  USING (true);
GRANT SELECT ON public.app_roadmap_items TO anon, authenticated;

-- Tabeller som ble opprettet utenfor migrasjonene (finnes i prod): sørg for RLS og lesing.
DO $$
BEGIN
  IF to_regclass('public.politician_profiles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.politician_profiles ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.politician_responses') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.politician_responses ENABLE ROW LEVEL SECURITY';
    -- Appen skriver med service_role (app/api/politician/response/route.ts).
    EXECUTE 'DROP POLICY IF EXISTS politician_responses_insert_verified ON public.politician_responses';
  END IF;
END $$;

-- Begrens user_id-eksponering (enumerering av bruker-ID-er brukt mot IDOR-RPC-ene):
-- user_badges / user_points_balances er i dag lesbare for anon med USING (true).
-- Vurder om offentlige profiler trenger dette; minimum: bare innloggede.
DROP POLICY IF EXISTS user_badges_select_public ON public.user_badges;
DROP POLICY IF EXISTS user_badges_select_own ON public.user_badges;
CREATE POLICY user_badges_select_own ON public.user_badges
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS user_points_balances_select ON public.user_points_balances;
DROP POLICY IF EXISTS user_points_balances_select_own ON public.user_points_balances;
CREATE POLICY user_points_balances_select_own ON public.user_points_balances
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- (Offentlig profilvisning hentes server-side med service_role.)

-- -----------------------------------------------------------------------------
-- 5. View uten security_invoker
-- -----------------------------------------------------------------------------
ALTER VIEW public.n8n_issues_missing_ai_summary SET (security_invoker = true);
REVOKE ALL ON public.n8n_issues_missing_ai_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.n8n_issues_missing_ai_summary TO service_role;

-- -----------------------------------------------------------------------------
-- 6. search_path på SECURITY DEFINER: legg pg_temp sist (ellers søkes pg_temp først
--    for relasjoner), og sett eksplisitt der det mangler.
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record; v_path text;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig,
           (SELECT substring(c from 'search_path=(.*)') FROM unnest(p.proconfig) c
             WHERE c LIKE 'search_path=%') AS sp
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname IN ('public', 'private', 'audit') AND p.prosecdef AND d.objid IS NULL
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

-- -----------------------------------------------------------------------------
-- 7. Valgfritt (avklar først): GraphQL brukes ikke av appen → steng for anon/authenticated.
-- -----------------------------------------------------------------------------
-- REVOKE USAGE ON SCHEMA graphql_public FROM anon, authenticated;
-- eller: DROP EXTENSION IF EXISTS pg_graphql;

COMMIT;

-- =============================================================================
-- Oppfølging som IKKE er SQL (se rapport.md):
--  * Funksjonene med p_user_id stoler på parameteren. Når de nå er service_role-only er
--    det trygt så lenge appen alltid sender user.id fra getUser(). Langsiktig: bytt til
--    auth.uid() i funksjonene og kall dem med session-klienten, eller behold service-only
--    + CI-vakt (ci-guard.md).
--  * PGRST_OPENAPI_MODE=disabled (eller 'ignore-privileges' av) i PostgREST-containeren.
--  * GoTrue: GOTRUE_SMS_AUTOCONFIRM=false / skru av phone-signup uten SMS-leverandør.
-- =============================================================================
