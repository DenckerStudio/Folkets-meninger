-- security-guard.sql – CI-vakt. Feiler (RAISE EXCEPTION) hvis databasen etter alle migrasjoner
-- har nye hull. Kjøres mot en fersk Supabase-database (supabase db start / db reset).
-- Allowlistene under må endres bevisst i samme PR som en ny offentlig funksjon/tabell.
DO $$
DECLARE
  -- Funksjoner som anon/authenticated BEVISST får kjøre (kun lesing av offentlige data).
  allow_anon text[] := ARRAY[
    'get_public_user_displays','get_issue_vote_totals','get_poll_totals',
    'get_poll_totals_by_fylke','match_issue_document_chunks'];
  allow_auth text[] := ARRAY[
    'get_public_user_displays','get_issue_vote_totals','get_poll_totals',
    'get_poll_totals_by_fylke','match_issue_document_chunks','is_admin'];
  -- Tabeller authenticated BEVISST kan skrive i (RLS-policy påkrevd).
  allow_auth_write text[] := ARRAY[
    'user_llm_credentials','notifications','notification_preferences',
    'notification_category_subscriptions','notification_label_subscriptions'];
  problems text[] := '{}';
  r record;
BEGIN
  -- 1) Alle tabeller i public skal ha RLS
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity LOOP
    problems := problems || format('RLS mangler: public.%I', r.relname);
  END LOOP;

  -- 2) Ingen funksjon utenfor allowlist kan kjøres av anon / authenticated
  FOR r IN SELECT p.oid::regprocedure AS sig, p.proname,
                  has_function_privilege('anon',p.oid,'EXECUTE') AS a,
                  has_function_privilege('authenticated',p.oid,'EXECUTE') AS u
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           LEFT JOIN pg_depend d ON d.objid=p.oid AND d.deptype='e'
           WHERE n.nspname IN ('public','private') AND d.objid IS NULL LOOP
    IF r.a AND NOT r.proname = ANY(allow_anon) THEN
      problems := problems || format('anon kan kjøre %s', r.sig);
    END IF;
    IF r.u AND NOT r.proname = ANY(allow_auth) THEN
      problems := problems || format('authenticated kan kjøre %s', r.sig);
    END IF;
  END LOOP;

  -- 3) SECURITY DEFINER må ha search_path med pg_temp sist
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           LEFT JOIN pg_depend d ON d.objid=p.oid AND d.deptype='e'
           WHERE p.prosecdef AND d.objid IS NULL AND n.nspname IN ('public','private','audit')
             AND NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%pg_temp') LOOP
    problems := problems || format('SECURITY DEFINER uten herdet search_path: %s', r.sig);
  END LOOP;

  -- 4) anon skal aldri kunne skrive; authenticated bare i allowlist
  FOR r IN SELECT c.relname,
                  has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE') AS a,
                  has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE') AS u
           FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind IN ('r','p') LOOP
    IF r.a THEN problems := problems || format('anon kan skrive i public.%I', r.relname); END IF;
    IF r.u AND NOT r.relname = ANY(allow_auth_write) THEN
      problems := problems || format('authenticated kan skrive i public.%I (ikke i allowlist)', r.relname);
    END IF;
  END LOOP;

  -- 5) Ingen skrive-policy med USING(true)/WITH CHECK(true) for anon/authenticated/public
  FOR r IN SELECT tablename, policyname FROM pg_policies
           WHERE schemaname='public' AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
             AND roles && ARRAY['anon','authenticated','public']::name[]
             AND (coalesce(qual,'') IN ('true','(true)') OR coalesce(with_check,'') IN ('true','(true)')) LOOP
    problems := problems || format('Åpen skrive-policy %s på %s', r.policyname, r.tablename);
  END LOOP;

  -- 6) Views lesbare for anon/authenticated må ha security_invoker
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='v'
             AND (has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('authenticated',c.oid,'SELECT'))
             AND NOT coalesce(c.reloptions::text[] && ARRAY['security_invoker=true','security_invoker=on'], false) LOOP
    problems := problems || format('View uten security_invoker: public.%I', r.relname);
  END LOOP;

  -- 7) Nye funksjoner skal ikke bli åpne via default privileges
  IF EXISTS (SELECT 1 FROM pg_default_acl d, aclexplode(d.defaclacl) a
             WHERE d.defaclobjtype='f' AND a.privilege_type='EXECUTE'
               AND a.grantee IN (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)) THEN
    problems := problems || 'Default privileges gir EXECUTE på nye funksjoner til PUBLIC/anon/authenticated'::text;
  END IF;

  -- 8) Audit-trigger på rolleendringer må finnes
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_audit_user_roles') THEN
    problems := problems || 'Mangler audit-trigger på public.user_roles'::text;
  END IF;

  IF array_length(problems,1) > 0 THEN
    RAISE EXCEPTION E'Sikkerhetsvakt feilet (% funn):\n  - %', array_length(problems,1), array_to_string(problems, E'\n  - ');
  END IF;
  RAISE NOTICE 'Sikkerhetsvakt OK';
END $$;
