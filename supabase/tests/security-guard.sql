-- security-guard.sql – CI-vakt. Se docs/security-allowlist.md.
DO $$
DECLARE
  allow_anon text[] := ARRAY[
    'get_public_user_displays', 'get_issue_vote_totals', 'get_poll_totals',
    'get_poll_totals_by_fylke', 'match_issue_document_chunks', 'get_prompt_results',
    'is_admin'
  ];
  allow_auth text[] := ARRAY[
    'get_public_user_displays', 'get_issue_vote_totals', 'get_poll_totals',
    'get_poll_totals_by_fylke', 'match_issue_document_chunks', 'get_prompt_results',
    'is_admin',
    'search_stortinget_issues_for_chat', 'search_issue_document_chunks_text'
  ];
  service_only text[] := ARRAY[
    'grant_stemme_plus', 'grant_stemme_plus_by_email', 'revoke_stemme_plus',
    'revoke_stemme_plus_by_email', 'list_stemme_plus_supporters',
    'grant_app_role', 'grant_app_role_by_email', 'revoke_app_role', 'revoke_app_role_by_email',
    'list_app_admins', 'publish_poll', 'archive_poll',
    'create_app_changelog_entry', 'delete_app_changelog_entry',
    'create_app_roadmap_item', 'update_app_roadmap_item', 'delete_app_roadmap_item',
    'set_app_roadmap_item_status', 'set_app_suggestion_status', 'set_app_suggestion_voting',
    'n8n_upsert_issue_ai_summary', 'n8n_save_document_embedding',
    'apply_verified_fylke_claim',
    'get_user_stance_on_issue', 'get_user_stance_history', 'get_user_stance_count',
    'get_user_stance_signals', 'user_has_political_consent', 'assert_rpc_caller_is_user',
    'require_admin_user_id', 'app_future_require_admin'
  ];
  problems text[] := '{}';
  r record;
  has_policy boolean;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity LOOP
    problems := problems || format('RLS mangler: public.%I', r.relname);
  END LOOP;

  FOR r IN SELECT p.oid::regprocedure AS sig, p.proname,
                  has_function_privilege('anon',p.oid,'EXECUTE') AS a,
                  has_function_privilege('authenticated',p.oid,'EXECUTE') AS u
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           LEFT JOIN pg_depend d ON d.objid=p.oid AND d.deptype='e'
           WHERE n.nspname IN ('public','private') AND d.objid IS NULL
             AND p.proname NOT LIKE 'n8n\_%' LOOP
    IF r.proname = ANY(service_only) AND (r.a OR r.u) THEN
      problems := problems || format('service-only RPC åpen: %s', r.sig);
    END IF;
    IF r.a AND NOT r.proname = ANY(allow_anon) THEN
      problems := problems || format('anon kan kjøre %s', r.sig);
    END IF;
    IF r.u AND NOT r.proname = ANY(allow_auth) THEN
      problems := problems || format('authenticated kan kjøre %s', r.sig);
    END IF;
  END LOOP;

  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           LEFT JOIN pg_depend d ON d.objid=p.oid AND d.deptype='e'
           WHERE p.prosecdef AND d.objid IS NULL AND n.nspname IN ('public','private','audit')
             AND p.proname NOT LIKE 'n8n\_%'
             AND NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%pg_temp') LOOP
    problems := problems || format('SECURITY DEFINER uten herdet search_path: %s', r.sig);
  END LOOP;

  FOR r IN SELECT c.relname,
                  has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE') AS a,
                  has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE') AS u
           FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind IN ('r','p') LOOP
    IF r.a THEN
      problems := problems || format('anon kan skrive i public.%I', r.relname);
    END IF;
    IF r.u THEN
      SELECT EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public' AND pol.tablename = r.relname
          AND pol.roles && ARRAY['authenticated']::name[]
          AND pol.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      ) INTO has_policy;
      IF NOT has_policy THEN
        problems := problems || format('authenticated kan skrive i public.%I uten skrive-policy', r.relname);
      END IF;
    END IF;
  END LOOP;

  FOR r IN SELECT tablename, policyname FROM pg_policies
           WHERE schemaname='public' AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
             AND roles && ARRAY['anon','authenticated','public']::name[]
             AND (coalesce(qual,'') IN ('true','(true)') OR coalesce(with_check,'') IN ('true','(true)')) LOOP
    problems := problems || format('Åpen skrive-policy %s på %s', r.policyname, r.tablename);
  END LOOP;

  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='v'
             AND (has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('authenticated',c.oid,'SELECT'))
             AND NOT coalesce(c.reloptions::text[] && ARRAY['security_invoker=true','security_invoker=on'], false)
             AND c.relname NOT LIKE 'n8n\_%' LOOP
    problems := problems || format('View uten security_invoker: public.%I', r.relname);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclobjtype = 'f'
      AND n.nspname = 'public'
      AND a.privilege_type = 'EXECUTE'
      AND a.grantee IN (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)
  ) THEN
    problems := problems || 'Default privileges gir EXECUTE på nye funksjoner til PUBLIC/anon/authenticated (public-skjema)'::text;
  END IF;

  IF to_regclass('public.user_badges') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_badges'
      AND policyname='user_badges_select_public'
  ) THEN
    problems := problems || 'user_badges_select_public policy mangler';
  END IF;

  IF array_length(problems,1) > 0 THEN
    RAISE EXCEPTION E'Sikkerhetsvakt feilet (% funn):\n  - %', array_length(problems,1), array_to_string(problems, E'\n  - ');
  END IF;
  RAISE NOTICE 'Sikkerhetsvakt OK';
END $$;
