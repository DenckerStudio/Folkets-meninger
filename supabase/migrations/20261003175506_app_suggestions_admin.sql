-- Admin handling for in-app forslag. Not applied in this change.

ALTER TABLE public.app_suggestions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';

ALTER TABLE public.app_suggestions
  DROP CONSTRAINT IF EXISTS app_suggestions_status_check;

ALTER TABLE public.app_suggestions
  ADD CONSTRAINT app_suggestions_status_check
  CHECK (status IN ('new', 'handled'));

ALTER TABLE public.app_suggestions
  ADD COLUMN IF NOT EXISTS handled_at timestamptz;

ALTER TABLE public.app_suggestions
  ADD COLUMN IF NOT EXISTS handled_by uuid REFERENCES public.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS app_suggestions_status_created_idx
  ON public.app_suggestions (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.app_suggestions TO service_role;

CREATE OR REPLACE FUNCTION public.list_app_suggestions(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  body text,
  status text,
  created_at timestamptz,
  handled_at timestamptz,
  handled_by uuid,
  author_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
BEGIN
  IF v_status IS NOT NULL AND v_status NOT IN ('new', 'handled') THEN
    RAISE EXCEPTION 'Invalid suggestion status';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.body,
    s.status,
    s.created_at,
    s.handled_at,
    s.handled_by,
    nullif(btrim(concat_ws(' ', u.first_name, u.last_name)), '')
  FROM public.app_suggestions s
  LEFT JOIN public.users u ON u.id = s.user_id
  WHERE v_status IS NULL OR s.status = v_status
  ORDER BY s.created_at DESC
  LIMIT v_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_app_suggestion_status(
  p_suggestion_id uuid,
  p_admin_user_id uuid,
  p_status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_status text := btrim(coalesce(p_status, ''));
  v_id uuid;
BEGIN
  IF p_suggestion_id IS NULL OR p_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing suggestion or admin id';
  END IF;

  IF v_status NOT IN ('new', 'handled') THEN
    RAISE EXCEPTION 'Invalid suggestion status';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_admin_user_id
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin required';
  END IF;

  PERFORM public.ensure_public_user(p_admin_user_id);

  UPDATE public.app_suggestions
  SET
    status = v_status,
    handled_at = CASE WHEN v_status = 'handled' THEN now() ELSE NULL END,
    handled_by = CASE WHEN v_status = 'handled' THEN p_admin_user_id ELSE NULL END
  WHERE id = p_suggestion_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Suggestion not found';
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_app_suggestions(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_app_suggestion_status(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_app_suggestions(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_app_suggestion_status(uuid, uuid, text) TO service_role;
