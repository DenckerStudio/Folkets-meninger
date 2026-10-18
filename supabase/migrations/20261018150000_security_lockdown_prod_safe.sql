-- =============================================================================
-- Prod-safe security lockdown (kan kjøres alene uten schema_migrations / eldre migrasjoner).
-- Idempotent: hopper over manglende tabeller, views og funksjoner (schema-drift).
-- Prioritet: Stemme+, publish_poll/archive_poll, app_roles, default privileges.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Audit (valgfritt — feiler ikke resten ved manglende rettigheter på auth.users)
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

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles';
    EXECUTE 'CREATE TRIGGER trg_audit_user_roles
      AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
      FOR EACH ROW EXECUTE FUNCTION audit.log_security_event()';
  END IF;
  IF to_regclass('public.app_roles') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_app_roles ON public.app_roles';
    EXECUTE 'CREATE TRIGGER trg_audit_app_roles
      AFTER INSERT OR UPDATE OR DELETE ON public.app_roles
      FOR EACH ROW EXECUTE FUNCTION audit.log_security_event()';
  END IF;
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_users_subscription ON public.users';
    EXECUTE 'CREATE TRIGGER trg_audit_users_subscription
      AFTER UPDATE OF subscription_tier, subscription_status ON public.users
      FOR EACH ROW
      WHEN (OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier
            OR OLD.subscription_status IS DISTINCT FROM NEW.subscription_status)
      EXECUTE FUNCTION audit.log_security_event()';
  END IF;

  BEGIN
    IF to_regclass('auth.users') IS NOT NULL THEN
      EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_auth_app_metadata ON auth.users';
      EXECUTE 'CREATE TRIGGER trg_audit_auth_app_metadata
        AFTER UPDATE OF raw_app_meta_data ON auth.users
        FOR EACH ROW
        WHEN (OLD.raw_app_meta_data IS DISTINCT FROM NEW.raw_app_meta_data)
        EXECUTE FUNCTION audit.log_security_event()';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege OR undefined_table OR invalid_schema_name THEN
      RAISE NOTICE 'Hopper over audit-trigger på auth.users: %', SQLERRM;
  END;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Funksjoner: lukk alt i public/private, åpne allowlist (inkl. Stemme+, polls, n8n, app-fremtid)
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'public') THEN
    EXECUTE 'REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'private') THEN
    EXECUTE 'REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO service_role';
  END IF;

  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname IN ('public', 'private')
      AND d.objid IS NULL
      AND p.prokind IN ('f', 'p')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- Eksplisitt prioritet (alle overloads) — samme effekt som løkken over, men dokumenterer prod-funn.
DO $$
DECLARE
  v_names text[] := ARRAY[
    'grant_stemme_plus','grant_stemme_plus_by_email','revoke_stemme_plus','revoke_stemme_plus_by_email',
    'list_stemme_plus_supporters','publish_poll','archive_poll','create_app_changelog_entry',
    'delete_app_changelog_entry','list_app_changelog_entries','create_app_roadmap_item',
    'delete_app_roadmap_item','list_app_roadmap_items','set_app_roadmap_item_status',
    'set_app_suggestion_status','set_app_suggestion_voting','n8n_upsert_issue_ai_summary',
    'n8n_save_document_embedding','n8n_finalize_document_storage','apply_verified_fylke_claim',
    'grant_app_role','grant_app_role_by_email','revoke_app_role','revoke_app_role_by_email',
    'cast_vote','get_user_vote_on_issue'
  ];
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(v_names)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_public_user_displays', 'get_issue_vote_totals', 'get_poll_totals',
        'get_poll_totals_by_fylke', 'match_issue_document_chunks'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Default privileges (nye objekter skal ikke åpnes for anon/authenticated)
-- -----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM PUBLIC, anon, authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
  RAISE NOTICE 'Kunne ikke endre default privileges for supabase_admin (%).', SQLERRM;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Tabeller: RLS + fjern skriv for anon/authenticated (kun eksisterende tabeller)
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'public') THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated';
  END IF;

  FOR r IN
    SELECT c.oid::regclass AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE %s FROM PUBLIC, anon, authenticated',
      r.tbl,
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.user_roles FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.user_roles TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.user_roles TO service_role';
  END IF;

  IF to_regclass('public.app_roles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.app_roles FORCE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.app_roles FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.app_roles TO service_role';
  END IF;

  IF to_regclass('public.user_roles') IS NOT NULL AND to_regclass('public.app_roles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_fkey';
    BEGIN
      EXECUTE 'ALTER TABLE public.user_roles
        ADD CONSTRAINT user_roles_role_fkey FOREIGN KEY (role)
        REFERENCES public.app_roles (role) ON UPDATE RESTRICT ON DELETE RESTRICT';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.user_llm_credentials') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_llm_credentials TO authenticated';
  END IF;
  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, UPDATE ON public.notifications TO authenticated';
  END IF;
  IF to_regclass('public.notification_preferences') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated';
  END IF;
  IF to_regclass('public.notification_category_subscriptions') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, DELETE ON public.notification_category_subscriptions TO authenticated';
  END IF;
  IF to_regclass('public.notification_label_subscriptions') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, DELETE ON public.notification_label_subscriptions TO authenticated';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles';
    EXECUTE 'CREATE POLICY user_profiles_update_own ON public.user_profiles
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF to_regclass('public.app_changelog_entries') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.app_changelog_entries FROM PUBLIC, anon, authenticated';
    EXECUTE 'DROP POLICY IF EXISTS app_changelog_entries_select_published ON public.app_changelog_entries';
    EXECUTE 'CREATE POLICY app_changelog_entries_select_published ON public.app_changelog_entries
      FOR SELECT TO anon, authenticated USING (published_at <= now())';
    EXECUTE 'GRANT SELECT ON public.app_changelog_entries TO anon, authenticated';
  END IF;

  IF to_regclass('public.app_roadmap_items') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.app_roadmap_items FROM PUBLIC, anon, authenticated';
    EXECUTE 'DROP POLICY IF EXISTS app_roadmap_items_select_public ON public.app_roadmap_items';
    EXECUTE 'CREATE POLICY app_roadmap_items_select_public ON public.app_roadmap_items
      FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'GRANT SELECT ON public.app_roadmap_items TO anon, authenticated';
  END IF;

  IF to_regclass('public.user_badges') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS user_badges_select_public ON public.user_badges';
    EXECUTE 'DROP POLICY IF EXISTS user_badges_select_own ON public.user_badges';
    EXECUTE 'CREATE POLICY user_badges_select_own ON public.user_badges
      FOR SELECT TO authenticated USING (user_id = auth.uid())';
  END IF;

  IF to_regclass('public.user_points_balances') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS user_points_balances_select ON public.user_points_balances';
    EXECUTE 'DROP POLICY IF EXISTS user_points_balances_select_own ON public.user_points_balances';
    EXECUTE 'CREATE POLICY user_points_balances_select_own ON public.user_points_balances
      FOR SELECT TO authenticated USING (user_id = auth.uid())';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. View security_invoker
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.n8n_issues_missing_ai_summary') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.n8n_issues_missing_ai_summary SET (security_invoker = true)';
    EXECUTE 'REVOKE ALL ON public.n8n_issues_missing_ai_summary FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT ON public.n8n_issues_missing_ai_summary TO service_role';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5. SECURITY DEFINER search_path
-- -----------------------------------------------------------------------------
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
    WHERE n.nspname IN ('public', 'private', 'audit')
      AND p.prosecdef
      AND d.objid IS NULL
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

COMMIT;
