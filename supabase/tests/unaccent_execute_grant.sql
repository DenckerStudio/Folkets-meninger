-- After 20261111100000: extensions.unaccent EXECUTE for service_role + SECURITY DEFINER owners.
DO $$
DECLARE
  v_unaccent record;
  v_definer record;
  v_any record;
BEGIN
  FOR v_unaccent IN
    SELECT p.oid,
           p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'extensions'
      AND p.proname = 'unaccent'
  LOOP
    IF NOT has_function_privilege('service_role', v_unaccent.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role missing EXECUTE on %', v_unaccent.sig;
    END IF;
    IF NOT has_function_privilege('postgres', v_unaccent.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'postgres missing EXECUTE on %', v_unaccent.sig;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'extensions' AND p.proname = 'unaccent'
  ) THEN
    RAISE EXCEPTION 'extensions.unaccent not found';
  END IF;

  FOR v_any IN
    SELECT p.oid, p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.proname = 'unaccent'
  LOOP
    IF has_function_privilege('anon', v_any.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon must not EXECUTE % (any schema)', v_any.sig;
    END IF;
    IF has_function_privilege('authenticated', v_any.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated must not EXECUTE % (any schema)', v_any.sig;
    END IF;
  END LOOP;

  FOR v_definer IN
    SELECT p.oid::regprocedure AS sig,
           pg_get_userbyid(p.proowner) AS owner_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND (
        pg_get_functiondef(p.oid) ILIKE '%fm_unaccent%'
        OR pg_get_functiondef(p.oid) ILIKE '%.unaccent(%'
      )
  LOOP
    FOR v_unaccent IN
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'extensions' AND p.proname = 'unaccent'
    LOOP
      IF NOT has_function_privilege(v_definer.owner_name, v_unaccent.oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'owner % missing EXECUTE on extensions.unaccent for %',
          v_definer.owner_name, v_definer.sig;
      END IF;
    END LOOP;
  END LOOP;

  EXECUTE 'SET LOCAL ROLE service_role';
  IF public.fm_unaccent('café') IS DISTINCT FROM 'cafe' THEN
    RAISE EXCEPTION 'fm_unaccent smoke failed as service_role';
  END IF;
  RESET ROLE;
END;
$$;
