-- Grant EXECUTE on extensions.unaccent to roles that need INVOKER calls (service_role)
-- and owners of SECURITY DEFINER public RPCs that call fm_unaccent / unaccent.
-- stortinget_issues.tsv (GENERATED) uses fm_unaccent as the session role on cron upsert.

BEGIN;

DO $$
DECLARE
  f regprocedure;
  owner_name text;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'extensions'
      AND p.proname = 'unaccent'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO postgres, service_role', f);

    FOR owner_name IN
      SELECT DISTINCT pg_get_userbyid(p2.proowner)
      FROM pg_proc p2
      JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
      WHERE n2.nspname = 'public'
        AND p2.prosecdef
        AND (
          pg_get_functiondef(p2.oid) ILIKE '%fm_unaccent%'
          OR pg_get_functiondef(p2.oid) ILIKE '%.unaccent(%'
        )
    LOOP
      IF owner_name IS NOT NULL AND owner_name <> '' THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', f, owner_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
