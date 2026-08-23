-- Site admin RBAC: user_roles is the source of truth (replaces ADMIN_EMAILS).
-- JWT app_metadata.role is synced for compatibility; is_admin() reads user_roles.

CREATE TABLE IF NOT EXISTS public.app_roles (
  role text PRIMARY KEY
);

INSERT INTO public.app_roles (role) VALUES ('admin')
ON CONFLICT (role) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL REFERENCES public.app_roles (role) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role)
);

CREATE INDEX IF NOT EXISTS user_roles_role_idx ON public.user_roles (role);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'True when the current JWT user has role=admin in user_roles.';

DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_roles_select_admin ON public.user_roles;
CREATE POLICY user_roles_select_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.sync_user_admin_metadata(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    UPDATE auth.users
    SET
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin'),
      updated_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE auth.users
    SET
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role',
      updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_app_role(
  p_user_id uuid,
  p_role text DEFAULT 'admin',
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
  IF p_role IS NULL OR btrim(p_role) = '' THEN
    RAISE EXCEPTION 'Missing role';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_roles WHERE role = p_role) THEN
    RAISE EXCEPTION 'Unknown role';
  END IF;

  INSERT INTO public.user_roles (user_id, role, granted_by)
  VALUES (p_user_id, p_role, p_granted_by)
  ON CONFLICT (user_id, role) DO UPDATE SET
    granted_at = now(),
    granted_by = coalesce(EXCLUDED.granted_by, public.user_roles.granted_by);

  PERFORM public.sync_user_admin_metadata(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_app_role_by_email(
  p_email text,
  p_role text DEFAULT 'admin',
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

  PERFORM public.grant_app_role(v_user_id, p_role, p_granted_by);
  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_app_role(
  p_user_id uuid,
  p_role text DEFAULT 'admin'
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

  IF p_role = 'admin' THEN
    IF (
      SELECT count(*) FROM public.user_roles WHERE role = 'admin' AND user_id <> p_user_id
    ) = 0
      AND EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin'
      )
    THEN
      RAISE EXCEPTION 'Cannot revoke the last admin';
    END IF;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id
    AND role = p_role;

  PERFORM public.sync_user_admin_metadata(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_app_role_by_email(
  p_email text,
  p_role text DEFAULT 'admin'
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

  PERFORM public.revoke_app_role(v_user_id, p_role);
  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_app_admins()
RETURNS TABLE (
  user_id uuid,
  email text,
  role text,
  granted_at timestamptz,
  granted_by uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    ur.user_id,
    u.email::text,
    ur.role,
    ur.granted_at,
    ur.granted_by
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role = 'admin'
  ORDER BY ur.granted_at ASC;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_user_admin_metadata(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_app_role(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_app_role_by_email(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_app_role(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_app_role_by_email(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_app_admins() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_user_admin_metadata(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_app_role(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_app_role_by_email(text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_app_role(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_app_role_by_email(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_app_admins() TO service_role;
