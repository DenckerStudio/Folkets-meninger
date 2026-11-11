-- After 20261111100000: service_role must execute extensions.unaccent via public.fm_unaccent (INVOKER).
DO $$
DECLARE
  v_fn text;
BEGIN
  SELECT p.oid::regprocedure::text
  INTO v_fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'extensions'
    AND p.proname = 'unaccent'
    AND pg_get_function_identity_arguments(p.oid) = 'regdictionary, text'
  LIMIT 1;

  IF v_fn IS NULL THEN
    RAISE EXCEPTION 'extensions.unaccent(regdictionary, text) not found';
  END IF;

  IF has_function_privilege('anon', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not EXECUTE %', v_fn;
  END IF;
  IF has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not EXECUTE %', v_fn;
  END IF;
  IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role missing EXECUTE on %', v_fn;
  END IF;

  SET LOCAL ROLE service_role;
  IF public.fm_unaccent('café') IS DISTINCT FROM 'cafe' THEN
    RAISE EXCEPTION 'fm_unaccent smoke failed as service_role';
  END IF;
  RESET ROLE;
END;
$$;
