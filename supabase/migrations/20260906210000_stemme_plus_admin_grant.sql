-- Admin/service-role helpers to grant or revoke Stemme+ without Stripe.

CREATE OR REPLACE FUNCTION public.grant_stemme_plus(
  p_user_id uuid,
  p_granted_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user id';
  END IF;

  UPDATE public.users
  SET
    subscription_tier = 'stemme_plus',
    subscription_status = 'active',
    subscription_period_end = NULL
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_stemme_plus_by_email(
  p_email text,
  p_granted_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  v_email := lower(btrim(coalesce(p_email, '')));
  IF v_email = '' THEN
    RAISE EXCEPTION 'Missing email';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  PERFORM public.grant_stemme_plus(v_user_id, p_granted_by);
  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_stemme_plus(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user id';
  END IF;

  UPDATE public.users
  SET
    subscription_tier = 'free',
    subscription_status = NULL,
    subscription_period_end = NULL
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_stemme_plus_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  v_email := lower(btrim(coalesce(p_email, '')));
  IF v_email = '' THEN
    RAISE EXCEPTION 'Missing email';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  PERFORM public.revoke_stemme_plus(v_user_id);
  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_stemme_plus_supporters()
RETURNS TABLE (
  user_id uuid,
  email text,
  subscription_status text,
  subscription_period_end timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    u.id AS user_id,
    au.email::text AS email,
    u.subscription_status,
    u.subscription_period_end
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.subscription_tier = 'stemme_plus'
  ORDER BY au.email NULLS LAST, u.id;
$$;

REVOKE ALL ON FUNCTION public.grant_stemme_plus(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_stemme_plus_by_email(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_stemme_plus(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_stemme_plus_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_stemme_plus_supporters() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.grant_stemme_plus(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_stemme_plus_by_email(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_stemme_plus(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_stemme_plus_by_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_stemme_plus_supporters() TO service_role;
