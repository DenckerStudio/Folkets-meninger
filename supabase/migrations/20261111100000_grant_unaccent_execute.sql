-- Grant EXECUTE on extensions.unaccent to service_role.
-- stortinget_issues.tsv (GENERATED) calls public.fm_unaccent → extensions.unaccent as the session role
-- (PostgREST service_role on cron upsert). Security lockdown removed PUBLIC EXECUTE on extension funcs.

BEGIN;

DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'extensions'
      AND p.proname = 'unaccent'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

COMMIT;
