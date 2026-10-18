-- Kjøres etter security-guard.sql på lokal Supabase (db reset).
-- Sjekker at nøkkel-RPC-er har EXECUTE for anon/authenticated og at admin-RPC-er er lukket.

DO $$
DECLARE
  problems text[] := '{}';
  fn text;
  anon_ok boolean;
  auth_ok boolean;
BEGIN
  -- anon må kunne lese aggregater
  FOREACH fn IN ARRAY ARRAY[
    'get_issue_vote_totals', 'get_poll_totals', 'get_public_user_displays'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
    ) THEN
      problems := problems || format('anon mangler EXECUTE på %s', fn);
    END IF;
  END LOOP;

  -- authenticated må kunne bruker-RPC-er (JWT / PostgREST)
  FOREACH fn IN ARRAY ARRAY[
    'cast_poll_vote', 'update_user_profile_names', 'set_issue_stance',
    'create_citizen_opinion', 'is_admin', 'user_has_public_identity'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
        AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ) THEN
      problems := problems || format('authenticated mangler EXECUTE på %s', fn);
    END IF;
  END LOOP;

  -- anon må ikke kunne admin-funksjoner
  FOREACH fn IN ARRAY ARRAY[
    'grant_stemme_plus_by_email', 'publish_poll', 'n8n_upsert_issue_ai_summary',
    'create_app_changelog_entry'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
    ) THEN
      problems := problems || format('anon kan fortsatt kjøre %s', fn);
    END IF;
  END LOOP;

  -- Offentlige badges/poeng: policy skal finnes
  IF to_regclass('public.user_badges') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_badges'
      AND policyname = 'user_badges_select_public'
  ) THEN
    problems := problems || 'user_badges_select_public policy mangler';
  END IF;

  IF array_length(problems, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'security-jwt-smoke feilet: %', array_to_string(problems, '; ');
  END IF;
  RAISE NOTICE 'security-jwt-smoke: ok';
END $$;
