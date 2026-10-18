-- Session-bound admin actor: never trust client-supplied admin UUID on SECURITY DEFINER RPCs.
-- Harden grant/revoke_app_role*; re-lock n8n_issues_missing_ai_summary view DML.

BEGIN;

SET LOCAL lock_timeout = '5s';

DROP FUNCTION IF EXISTS public.app_future_require_admin(uuid);

CREATE OR REPLACE FUNCTION public.app_future_require_admin()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin required';
  END IF;

  PERFORM public.ensure_public_user(v_uid);
  RETURN v_uid;
END;
$function$;

REVOKE ALL ON FUNCTION public.app_future_require_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_future_require_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.grant_app_role(
  p_user_id uuid,
  p_role text DEFAULT 'admin',
  p_granted_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_granted_by uuid;
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

  IF v_actor IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
      RAISE EXCEPTION 'Admin required';
    END IF;
    v_granted_by := NULL;
  ELSE
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Admin required';
    END IF;
    v_granted_by := v_actor;
  END IF;

  INSERT INTO public.user_roles (user_id, role, granted_by)
  VALUES (p_user_id, p_role, v_granted_by)
  ON CONFLICT (user_id, role) DO UPDATE SET
    granted_at = now(),
    granted_by = coalesce(EXCLUDED.granted_by, public.user_roles.granted_by);

  PERFORM public.sync_user_admin_metadata(p_user_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.grant_app_role_by_email(
  p_email text,
  p_role text DEFAULT 'admin',
  p_granted_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
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

  PERFORM public.grant_app_role(v_user_id, p_role, NULL);
  RETURN v_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_app_role(
  p_user_id uuid,
  p_role text DEFAULT 'admin'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin required';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.revoke_app_role_by_email(
  p_email text,
  p_role text DEFAULT 'admin'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
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
$function$;

DROP FUNCTION IF EXISTS public.create_app_changelog_entry(uuid, text, text);

CREATE OR REPLACE FUNCTION public.create_app_changelog_entry(
  p_title text,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_id uuid;
  v_actor uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
BEGIN
  v_actor := public.app_future_require_admin();

  IF char_length(v_title) < 4 OR char_length(v_title) > 80 THEN
    RAISE EXCEPTION 'Title must be between 4 and 80 characters';
  END IF;
  IF char_length(v_body) < 10 OR char_length(v_body) > 2000 THEN
    RAISE EXCEPTION 'Body must be between 10 and 2000 characters';
  END IF;

  INSERT INTO public.app_changelog_entries (title, body, created_by)
  VALUES (v_title, v_body, v_actor)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.delete_app_changelog_entry(uuid, uuid);

CREATE OR REPLACE FUNCTION public.delete_app_changelog_entry(p_entry_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.app_future_require_admin();

  DELETE FROM public.app_changelog_entries
  WHERE id = p_entry_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Changelog entry not found';
  END IF;

  RETURN v_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.create_app_roadmap_item(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.create_app_roadmap_item(uuid, text, text, text, integer);

CREATE OR REPLACE FUNCTION public.create_app_roadmap_item(
  p_title text,
  p_body text,
  p_status text,
  p_sort_order integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_id uuid;
  v_actor uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_status text := btrim(coalesce(p_status, ''));
  v_sort integer := coalesce(p_sort_order, 0);
BEGIN
  v_actor := public.app_future_require_admin();

  IF char_length(v_title) < 4 OR char_length(v_title) > 80 THEN
    RAISE EXCEPTION 'Title must be between 4 and 80 characters';
  END IF;
  IF char_length(v_body) < 10 OR char_length(v_body) > 1000 THEN
    RAISE EXCEPTION 'Body must be between 10 and 1000 characters';
  END IF;
  IF v_status NOT IN ('planned', 'in_progress', 'done') THEN
    RAISE EXCEPTION 'Invalid roadmap status';
  END IF;
  IF v_sort < 0 OR v_sort > 9999 THEN
    RAISE EXCEPTION 'Invalid sort order';
  END IF;

  INSERT INTO public.app_roadmap_items (title, body, status, sort_order, created_by)
  VALUES (v_title, v_body, v_status, v_sort, v_actor)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.update_app_roadmap_item(uuid, uuid, text, text, text, integer);

CREATE OR REPLACE FUNCTION public.update_app_roadmap_item(
  p_item_id uuid,
  p_title text DEFAULT NULL,
  p_body text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_sort_order integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_id uuid;
  v_title text;
  v_body text;
  v_status text;
BEGIN
  PERFORM public.app_future_require_admin();

  IF p_title IS NOT NULL THEN
    v_title := btrim(p_title);
    IF char_length(v_title) < 4 OR char_length(v_title) > 80 THEN
      RAISE EXCEPTION 'Title must be between 4 and 80 characters';
    END IF;
  END IF;
  IF p_body IS NOT NULL THEN
    v_body := btrim(p_body);
    IF char_length(v_body) < 10 OR char_length(v_body) > 1000 THEN
      RAISE EXCEPTION 'Body must be between 10 and 1000 characters';
    END IF;
  END IF;
  IF p_status IS NOT NULL THEN
    v_status := btrim(p_status);
    IF v_status NOT IN ('planned', 'in_progress', 'done') THEN
      RAISE EXCEPTION 'Invalid roadmap status';
    END IF;
  END IF;
  IF p_sort_order IS NOT NULL AND (p_sort_order < 0 OR p_sort_order > 9999) THEN
    RAISE EXCEPTION 'Invalid sort order';
  END IF;

  UPDATE public.app_roadmap_items
  SET
    title = coalesce(v_title, title),
    body = coalesce(v_body, body),
    status = coalesce(v_status, status),
    sort_order = coalesce(p_sort_order, sort_order)
  WHERE id = p_item_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Roadmap item not found';
  END IF;

  RETURN v_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.set_app_roadmap_item_status(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.set_app_roadmap_item_status(
  p_item_id uuid,
  p_status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_id uuid;
  v_status text := btrim(coalesce(p_status, ''));
BEGIN
  PERFORM public.app_future_require_admin();

  IF v_status NOT IN ('planned', 'in_progress', 'done') THEN
    RAISE EXCEPTION 'Invalid roadmap status';
  END IF;

  UPDATE public.app_roadmap_items
  SET status = v_status
  WHERE id = p_item_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Roadmap item not found';
  END IF;

  RETURN v_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.delete_app_roadmap_item(uuid, uuid);

CREATE OR REPLACE FUNCTION public.delete_app_roadmap_item(p_item_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.app_future_require_admin();

  DELETE FROM public.app_roadmap_items
  WHERE id = p_item_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Roadmap item not found';
  END IF;

  RETURN v_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.set_app_suggestion_voting(uuid, uuid, boolean);

CREATE OR REPLACE FUNCTION public.set_app_suggestion_voting(
  p_suggestion_id uuid,
  p_voting_open boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.app_future_require_admin();

  IF p_suggestion_id IS NULL THEN
    RAISE EXCEPTION 'Missing suggestion id';
  END IF;

  UPDATE public.app_suggestions
  SET voting_open = coalesce(p_voting_open, false)
  WHERE id = p_suggestion_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Suggestion not found';
  END IF;

  RETURN v_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.set_app_suggestion_status(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.set_app_suggestion_status(
  p_suggestion_id uuid,
  p_status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_status text := btrim(coalesce(p_status, ''));
  v_id uuid;
  v_actor uuid;
BEGIN
  v_actor := public.app_future_require_admin();

  IF p_suggestion_id IS NULL THEN
    RAISE EXCEPTION 'Missing suggestion id';
  END IF;

  IF v_status NOT IN ('new', 'handled') THEN
    RAISE EXCEPTION 'Invalid suggestion status';
  END IF;

  UPDATE public.app_suggestions
  SET
    status = v_status,
    handled_at = CASE WHEN v_status = 'handled' THEN now() ELSE NULL END,
    handled_by = CASE WHEN v_status = 'handled' THEN v_actor ELSE NULL END
  WHERE id = p_suggestion_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Suggestion not found';
  END IF;

  RETURN v_id;
END;
$function$;

-- Admin write RPCs: session JWT only (service_role cannot spoof actor).
REVOKE ALL ON FUNCTION public.grant_app_role(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_app_role_by_email(text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_app_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_app_role_by_email(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_app_role(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_app_role_by_email(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_app_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_app_role_by_email(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_app_changelog_entry(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_app_changelog_entry(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_app_changelog_entry(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_app_changelog_entry(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.create_app_roadmap_item(text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_app_roadmap_item(uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_app_roadmap_item_status(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_app_roadmap_item(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_app_roadmap_item(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_app_roadmap_item(uuid, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_app_roadmap_item_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_app_roadmap_item(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.set_app_suggestion_voting(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_app_suggestion_status(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_app_suggestion_voting(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_app_suggestion_status(uuid, text) TO authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.n8n_issues_missing_ai_summary') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.n8n_issues_missing_ai_summary FROM PUBLIC, anon, authenticated';
    EXECUTE 'REVOKE ALL ON public.n8n_issues_missing_ai_summary FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT ON public.n8n_issues_missing_ai_summary TO service_role';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
