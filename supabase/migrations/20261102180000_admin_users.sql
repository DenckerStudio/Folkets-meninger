-- Admin user directory, audit log, and list/anonymize RPCs (manual apply).

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_log_action_check CHECK (char_length(btrim(action)) > 0)
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.admin_write_audit_log(
  p_actor_id uuid,
  p_action text,
  p_target_user_id uuid DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
BEGIN
  PERFORM public.require_admin_user_id(p_actor_id);

  IF p_action IS NULL OR btrim(p_action) = '' THEN
    RAISE EXCEPTION 'Missing audit action';
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, meta)
  VALUES (
    p_actor_id,
    btrim(p_action),
    p_target_user_id,
    COALESCE(p_meta, '{}'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_write_audit_log(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_write_audit_log(uuid, text, uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_assert_user_mutation_allowed(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_prevent_self boolean DEFAULT true,
  p_prevent_last_admin boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
BEGIN
  PERFORM public.require_admin_user_id(p_admin_user_id);

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing target user';
  END IF;

  IF p_prevent_self AND p_admin_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot modify self';
  END IF;

  IF p_prevent_last_admin THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = p_target_user_id
        AND role = 'admin'
    )
    AND (
      SELECT count(*)
      FROM public.user_roles
      WHERE role = 'admin'
        AND user_id <> p_target_user_id
    ) = 0
    THEN
      RAISE EXCEPTION 'Cannot revoke the last admin';
    END IF;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_assert_user_mutation_allowed(uuid, uuid, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assert_user_mutation_allowed(uuid, uuid, boolean, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_anonymize_user(
  p_admin_user_id uuid,
  p_target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
BEGIN
  PERFORM public.require_admin_user_id(p_admin_user_id);

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing target user';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  PERFORM public.ensure_public_user(p_target_user_id);

  UPDATE public.users
  SET
    first_name = 'Slettet',
    last_name = 'bruker',
    name = 'Slettet bruker',
    email = NULL,
    bio = NULL,
    avatar_url = NULL,
    profile_is_public = false,
    show_party_preference = false
  WHERE id = p_target_user_id;

  PERFORM public.admin_write_audit_log(
    p_admin_user_id,
    'anonymize_user',
    p_target_user_id,
    jsonb_build_object('scope', 'public_profile')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_anonymize_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_anonymize_user(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_admin_user_id uuid,
  p_query text DEFAULT NULL,
  p_role_filter text DEFAULT 'all',
  p_tier_filter text DEFAULT 'all',
  p_status_filter text DEFAULT 'all',
  p_sort text DEFAULT 'created_at',
  p_sort_dir text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_actor uuid;
  v_q text;
  v_role text;
  v_tier text;
  v_status text;
  v_sort text;
  v_dir text;
  v_page integer;
  v_size integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  v_actor := public.require_admin_user_id(p_admin_user_id);

  v_q := nullif(btrim(coalesce(p_query, '')), '');
  v_role := lower(btrim(coalesce(p_role_filter, 'all')));
  v_tier := lower(btrim(coalesce(p_tier_filter, 'all')));
  v_status := lower(btrim(coalesce(p_status_filter, 'all')));
  v_sort := lower(btrim(coalesce(p_sort, 'created_at')));
  v_dir := lower(btrim(coalesce(p_sort_dir, 'desc')));
  v_page := greatest(coalesce(p_page, 1), 1);
  v_size := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_offset := (v_page - 1) * v_size;

  IF v_role NOT IN ('all', 'admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role filter';
  END IF;
  IF v_tier NOT IN ('all', 'stemme_plus', 'free') THEN
    RAISE EXCEPTION 'Invalid tier filter';
  END IF;
  IF v_status NOT IN ('all', 'active', 'deactivated') THEN
    RAISE EXCEPTION 'Invalid status filter';
  END IF;
  IF v_sort NOT IN ('created_at', 'email', 'last_sign_in', 'display_name') THEN
    RAISE EXCEPTION 'Invalid sort';
  END IF;
  IF v_dir NOT IN ('asc', 'desc') THEN
    RAISE EXCEPTION 'Invalid sort direction';
  END IF;

  WITH base AS (
    SELECT
      au.id,
      au.email::text AS email,
      au.created_at,
      au.last_sign_in_at,
      (au.banned_until IS NOT NULL AND au.banned_until > now()) AS is_deactivated,
      pu.first_name,
      pu.last_name,
      pu.name AS display_name,
      pu.subscription_tier,
      pu.subscription_status,
      pu.subscription_period_end,
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = au.id
          AND ur.role = 'admin'
      ) AS is_admin
    FROM auth.users au
    LEFT JOIN public.users pu ON pu.id = au.id
    WHERE
      (
        v_q IS NULL
        OR au.email ILIKE '%' || replace(replace(v_q, '%', '\%'), '_', '\_') || '%' ESCAPE '\'
        OR coalesce(pu.first_name, '') ILIKE '%' || replace(replace(v_q, '%', '\%'), '_', '\_') || '%' ESCAPE '\'
        OR coalesce(pu.last_name, '') ILIKE '%' || replace(replace(v_q, '%', '\%'), '_', '\_') || '%' ESCAPE '\'
        OR coalesce(pu.name, '') ILIKE '%' || replace(replace(v_q, '%', '\%'), '_', '\_') || '%' ESCAPE '\'
      )
      AND (
        v_role = 'all'
        OR (v_role = 'admin' AND EXISTS (
          SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id AND ur.role = 'admin'
        ))
        OR (v_role = 'member' AND NOT EXISTS (
          SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id AND ur.role = 'admin'
        ))
      )
      AND (
        v_tier = 'all'
        OR (v_tier = 'stemme_plus' AND coalesce(pu.subscription_tier, 'free') = 'stemme_plus')
        OR (v_tier = 'free' AND coalesce(pu.subscription_tier, 'free') <> 'stemme_plus')
      )
      AND (
        v_status = 'all'
        OR (v_status = 'active' AND NOT (au.banned_until IS NOT NULL AND au.banned_until > now()))
        OR (v_status = 'deactivated' AND au.banned_until IS NOT NULL AND au.banned_until > now())
      )
  ),
  counted AS (
    SELECT count(*)::bigint AS total FROM base
  ),
  page AS (
    SELECT *
    FROM base
    ORDER BY
      CASE WHEN v_sort = 'email' AND v_dir = 'asc' THEN email END ASC NULLS LAST,
      CASE WHEN v_sort = 'email' AND v_dir = 'desc' THEN email END DESC NULLS LAST,
      CASE WHEN v_sort = 'display_name' AND v_dir = 'asc' THEN display_name END ASC NULLS LAST,
      CASE WHEN v_sort = 'display_name' AND v_dir = 'desc' THEN display_name END DESC NULLS LAST,
      CASE WHEN v_sort = 'last_sign_in' AND v_dir = 'asc' THEN last_sign_in_at END ASC NULLS LAST,
      CASE WHEN v_sort = 'last_sign_in' AND v_dir = 'desc' THEN last_sign_in_at END DESC NULLS LAST,
      CASE WHEN v_sort = 'created_at' AND v_dir = 'asc' THEN created_at END ASC NULLS LAST,
      CASE WHEN v_sort = 'created_at' AND v_dir = 'desc' THEN created_at END DESC NULLS LAST,
      id ASC
    LIMIT v_size
    OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'user_id', p.id,
            'email', p.email,
            'first_name', p.first_name,
            'last_name', p.last_name,
            'display_name', p.display_name,
            'is_admin', p.is_admin,
            'subscription_tier', coalesce(p.subscription_tier, 'free'),
            'subscription_status', p.subscription_status,
            'subscription_period_end', p.subscription_period_end,
            'is_deactivated', p.is_deactivated,
            'created_at', p.created_at,
            'last_sign_in_at', p.last_sign_in_at
          )
        ),
        '[]'::jsonb
      )
      FROM page p
    )
  INTO v_total, v_rows;

  RETURN jsonb_build_object(
    'page', v_page,
    'page_size', v_size,
    'total', coalesce(v_total, 0),
    'users', coalesce(v_rows, '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_users(uuid, text, text, text, text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(uuid, text, text, text, text, text, text, integer, integer) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
