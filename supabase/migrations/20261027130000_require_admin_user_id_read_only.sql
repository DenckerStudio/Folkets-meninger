-- STABLE admin gate RPCs must not write (SQLSTATE 25006 in read-only transactions).

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.require_admin_user_id(p_actor uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION 'Missing admin actor';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_actor
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin required';
  END IF;

  RETURN p_actor;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_future_require_admin(p_admin_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
BEGIN
  PERFORM public.require_admin_user_id(p_admin_user_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.require_admin_user_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.require_admin_user_id(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.app_future_require_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_future_require_admin(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
