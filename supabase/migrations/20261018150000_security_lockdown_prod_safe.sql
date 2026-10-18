-- =============================================================================
-- Prod-safe security lockdown (kan kjøres alene). Idempotent + schema-drift-tolerant.
-- n8n_* og n8n-skrevne tabeller: se 20261018160000_security_lockdown_n8n.sql.
-- Allowlist dokumentert i docs/security-allowlist.md.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Audit (valgfritt)
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS audit;
REVOKE ALL ON SCHEMA audit FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA audit TO service_role;

CREATE TABLE IF NOT EXISTS audit.security_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  table_name text NOT NULL,
  operation text NOT NULL,
  target_id text,
  old_data jsonb,
  new_data jsonb,
  db_user text NOT NULL DEFAULT current_user,
  session_user_name text NOT NULL DEFAULT session_user,
  jwt_role text,
  jwt_sub text,
  client_addr inet DEFAULT inet_client_addr(),
  app_name text DEFAULT current_setting('application_name', true)
);
ALTER TABLE audit.security_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON audit.security_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON audit.security_events TO service_role;

-- -----------------------------------------------------------------------------
-- 1. Lukk alle funksjoner → service_role (unntak n8n_*), deretter allowlist
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  -- Ikke REVOKE ON ALL FUNCTIONS (inkl. vector/pgvector eid av superuser) — per-funksjon under.
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname IN ('public', 'private')
      AND d.objid IS NULL
      AND p.prokind IN ('f', 'p')
      AND p.proname NOT LIKE 'n8n\_%'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- Allowlist: anon (offentlig lesing / aggregater + is_admin i RLS for anon)
DO $$
DECLARE
  v_names text[] := ARRAY[
    'get_public_user_displays', 'get_issue_vote_totals', 'get_poll_totals',
    'get_poll_totals_by_fylke', 'match_issue_document_chunks', 'get_prompt_results',
    'is_admin'
  ];
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(v_names)
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
  END LOOP;
END $$;

-- Allowlist: authenticated (bruker-JWT / PostgREST + RLS-hjelpere + app-flyt)
DO $$
DECLARE
  v_names text[] := ARRAY[
    'is_admin', 'user_has_public_identity',
    'cast_vote', 'cast_poll_vote', 'get_user_vote_on_issue', 'get_user_poll_vote',
    'get_user_vote_history', 'set_issue_stance', 'get_user_stance_on_issue',
    'get_user_stance_history', 'get_user_stance_count', 'get_user_stance_signals',
    'update_user_profile_names', 'create_citizen_opinion', 'create_citizen_opinion_reply',
    'create_app_suggestion', 'cast_app_suggestion_vote', 'create_hearing_comment',
    'set_user_onboarding_state', 'report_content', 'create_opinion_innspill',
    'endorse_opinion_innspill', 'user_has_political_consent', 'record_political_consent',
    'withdraw_political_consent', 'withdraw_all_political_consents',
    'search_stortinget_issues_for_chat', 'search_issue_document_chunks_text'
  ];
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(v_names)
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- Eksplisitt service_role-only (admin / Stemme+ / app-fremtid-skriv — ikke n8n_*)
DO $$
DECLARE
  v_names text[] := ARRAY[
    'grant_stemme_plus', 'grant_stemme_plus_by_email', 'revoke_stemme_plus',
    'revoke_stemme_plus_by_email', 'list_stemme_plus_supporters',
    'grant_app_role', 'grant_app_role_by_email', 'revoke_app_role',
    'revoke_app_role_by_email', 'list_app_admins', 'sync_user_admin_metadata',
    'publish_poll', 'archive_poll', 'create_system_poll_draft', 'ensure_stortinget_poll',
    'create_app_changelog_entry', 'delete_app_changelog_entry', 'list_app_changelog_entries',
    'create_app_roadmap_item', 'delete_app_roadmap_item', 'list_app_roadmap_items',
    'set_app_roadmap_item_status', 'set_app_suggestion_status', 'set_app_suggestion_voting',
    'list_app_suggestions', 'list_voting_app_suggestions',
    'apply_verified_fylke_claim',
    'award_user_points', 'get_stance_totals_batch', 'get_vote_totals_batch',
    'mark_opinion_innspill_packaged', 'purge_political_processing_data',
    'reclaim_document_body_storage'
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
END $$;

-- -----------------------------------------------------------------------------
-- 2. Default privileges
-- -----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    EXECUTE 'SET LOCAL ROLE supabase_admin';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM PUBLIC, anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM PUBLIC, anon, authenticated';
    EXECUTE 'RESET ROLE';
  END IF;
EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'Kunne ikke endre default privileges for supabase_admin (%).', SQLERRM;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Tabeller: ENABLE RLS (ikke FORCE globalt), fjern bred DML (unntak n8n-tabeller)
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS tbl, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    IF r.relname IN ('document_chunks', 'stortinget_issue_documents') THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE %s FROM PUBLIC, anon, authenticated',
      r.tbl
    );
  END LOOP;
END $$;

-- app_roles / user_roles: FORCE RLS (admin-tabeller)
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
END $$;

-- FK: fyll manglende app_roles før RESTRICT-FK
DO $$
DECLARE
  v_orphans int;
BEGIN
  IF to_regclass('public.user_roles') IS NULL OR to_regclass('public.app_roles') IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.app_roles (role)
  SELECT DISTINCT ur.role
  FROM public.user_roles ur
  LEFT JOIN public.app_roles ar ON ar.role = ur.role
  WHERE ar.role IS NULL
  ON CONFLICT (role) DO NOTHING;

  SELECT count(*) INTO v_orphans
  FROM public.user_roles ur
  LEFT JOIN public.app_roles ar ON ar.role = ur.role
  WHERE ar.role IS NULL;

  IF v_orphans > 0 THEN
    RAISE NOTICE 'Hopper over user_roles_role_fkey: % foreldreløse roller', v_orphans;
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_fkey';
  BEGIN
    EXECUTE 'ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_role_fkey FOREIGN KEY (role)
      REFERENCES public.app_roles (role) ON UPDATE RESTRICT ON DELETE RESTRICT';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- Tabell-grants fra eksisterende RLS-policies (SELECT/INSERT/UPDATE/DELETE)
-- Policy-rolle {public} utvider til både anon og authenticated.
DO $$
DECLARE
  pol record;
  role_name name;
  grantee name;
  grantees name[];
  i int;
BEGIN
  FOR pol IN
    SELECT tablename, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND NOT (
        cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
        AND coalesce(trim(both from qual), '') IN ('false', '(false)')
        AND coalesce(trim(both from with_check), '') IN ('', 'false', '(false)')
      )
  LOOP
    grantees := ARRAY[]::name[];
    FOREACH role_name IN ARRAY pol.roles LOOP
      IF role_name = 'public' THEN
        grantees := grantees || ARRAY['anon'::name, 'authenticated'::name];
      ELSIF role_name IN ('anon', 'authenticated') THEN
        grantees := array_append(grantees, role_name);
      END IF;
    END LOOP;
    SELECT array_agg(DISTINCT g ORDER BY g) INTO grantees
    FROM unnest(grantees) AS g;

    IF grantees IS NULL THEN
      CONTINUE;
    END IF;

    FOR i IN 1 .. coalesce(array_length(grantees, 1), 0) LOOP
      grantee := grantees[i];
      IF pol.cmd IN ('SELECT', 'ALL') THEN
        EXECUTE format('GRANT SELECT ON public.%I TO %I', pol.tablename, grantee);
      END IF;
      IF pol.cmd IN ('INSERT', 'ALL') THEN
        EXECUTE format('GRANT INSERT ON public.%I TO %I', pol.tablename, grantee);
      END IF;
      IF pol.cmd IN ('UPDATE', 'ALL') THEN
        EXECUTE format('GRANT UPDATE ON public.%I TO %I', pol.tablename, grantee);
      END IF;
      IF pol.cmd IN ('DELETE', 'ALL') THEN
        EXECUTE format('GRANT DELETE ON public.%I TO %I', pol.tablename, grantee);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Appens fremtid: lesing uten skriv for anon/authenticated
DO $$
BEGIN
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
END $$;

-- IKKE endre user_badges / user_points_balances — offentlig visning beholdes.

-- -----------------------------------------------------------------------------
-- 4. SECURITY DEFINER search_path
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
    WHERE n.nspname IN ('public', 'private', 'audit') AND p.prosecdef AND d.objid IS NULL
      AND p.proname NOT LIKE 'n8n\_%'
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
-- 5. RLS-policyer: EXECUTE på funksjoner i qual/with_check (SIST — etter REVOKE ALL)
--    Matcher kvalifiserte og ukvalifiserte kall i public/private via pg_proc.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
  role_name name;
  grantee name;
  grantees name[];
  i int;
  expr text;
  fn record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'private') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA private TO anon, authenticated';
  END IF;

  FOR pol IN
    SELECT tablename, roles, coalesce(qual, '') || ' ' || coalesce(with_check, '') AS expr
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    expr := pol.expr;
    grantees := ARRAY[]::name[];
    FOREACH role_name IN ARRAY pol.roles LOOP
      IF role_name = 'public' THEN
        grantees := grantees || ARRAY['anon'::name, 'authenticated'::name];
      ELSIF role_name IN ('anon', 'authenticated') THEN
        grantees := array_append(grantees, role_name);
      END IF;
    END LOOP;
    SELECT array_agg(DISTINCT g ORDER BY g) INTO grantees
    FROM unnest(grantees) AS g;

    IF grantees IS NULL OR expr = ' ' OR length(trim(expr)) = 0 THEN
      CONTINUE;
    END IF;

    FOR fn IN
      SELECT p.oid::regprocedure AS sig, p.proname, n.nspname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
      WHERE n.nspname IN ('public', 'private')
        AND d.objid IS NULL
        AND p.prokind IN ('f', 'p')
        AND p.proname NOT LIKE 'n8n\_%'
        AND (
          expr ~* ('\m' || p.proname || '\s*\(')
          OR expr ~* ('\m' || n.nspname || '\.' || p.proname || '\s*\(')
        )
    LOOP
      FOR i IN 1 .. coalesce(array_length(grantees, 1), 0) LOOP
        grantee := grantees[i];
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', fn.sig, grantee);
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
