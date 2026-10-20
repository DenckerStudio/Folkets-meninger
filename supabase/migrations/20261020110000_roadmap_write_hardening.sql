-- Harden roadmap writes: admin-checked RPC only (no direct table UPDATE from app).

BEGIN;

CREATE OR REPLACE FUNCTION public.create_app_roadmap_item(
  p_admin_user_id uuid,
  p_title text,
  p_body text,
  p_status text,
  p_sort_order integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', pg_temp
AS $function$
DECLARE
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_status text := btrim(coalesce(p_status, ''));
  v_sort integer := coalesce(p_sort_order, 0);
BEGIN
  PERFORM public.app_future_require_admin(p_admin_user_id);

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
  VALUES (v_title, v_body, v_status, v_sort, p_admin_user_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_app_roadmap_item(
  p_admin_user_id uuid,
  p_item_id uuid,
  p_title text DEFAULT NULL,
  p_body text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_sort_order integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', pg_temp
AS $function$
DECLARE
  v_id uuid;
  v_title text;
  v_body text;
  v_status text;
BEGIN
  PERFORM public.app_future_require_admin(p_admin_user_id);

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

REVOKE ALL ON FUNCTION public.create_app_roadmap_item(uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_app_roadmap_item(uuid, text, text, text, integer) TO service_role;

DROP FUNCTION IF EXISTS public.create_app_roadmap_item(uuid, text, text, text);

REVOKE ALL ON FUNCTION public.update_app_roadmap_item(uuid, uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_app_roadmap_item(uuid, uuid, text, text, text, integer) TO service_role;

ALTER TABLE public.app_roadmap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_roadmap_items FORCE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.app_roadmap_items FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS app_roadmap_items_authenticated_write ON public.app_roadmap_items;
DROP POLICY IF EXISTS app_roadmap_items_insert ON public.app_roadmap_items;
DROP POLICY IF EXISTS app_roadmap_items_update ON public.app_roadmap_items;
DROP POLICY IF EXISTS app_roadmap_items_delete ON public.app_roadmap_items;

-- migration-sql-lint: static REVOKE
REVOKE ALL ON FUNCTION public.create_app_roadmap_item(uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_app_roadmap_item(uuid, uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
