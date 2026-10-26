-- Changelog drafts: real publication_status (no 2099 published_at hack). Public reads exclude drafts.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.app_changelog_entries
  ADD COLUMN IF NOT EXISTS publication_status text;

ALTER TABLE public.app_changelog_entries
  ADD COLUMN IF NOT EXISTS idempotency_key text;

UPDATE public.app_changelog_entries
SET publication_status = CASE
  WHEN published_at IS NULL THEN 'draft'
  WHEN published_at > now() + interval '1 day' THEN 'draft'
  WHEN published_at >= timestamptz '2099-01-01' THEN 'draft'
  ELSE 'published'
END
WHERE publication_status IS NULL;

ALTER TABLE public.app_changelog_entries
  ALTER COLUMN published_at DROP NOT NULL;

UPDATE public.app_changelog_entries
SET published_at = NULL
WHERE publication_status = 'draft';

ALTER TABLE public.app_changelog_entries
  ALTER COLUMN publication_status SET DEFAULT 'published';

ALTER TABLE public.app_changelog_entries
  ALTER COLUMN publication_status SET NOT NULL;

ALTER TABLE public.app_changelog_entries
  DROP CONSTRAINT IF EXISTS app_changelog_entries_publication_status_check;

ALTER TABLE public.app_changelog_entries
  ADD CONSTRAINT app_changelog_entries_publication_status_check
  CHECK (publication_status IN ('draft', 'published'));

ALTER TABLE public.app_changelog_entries
  DROP CONSTRAINT IF EXISTS app_changelog_entries_published_pair_check;

ALTER TABLE public.app_changelog_entries
  ADD CONSTRAINT app_changelog_entries_published_pair_check
  CHECK (
    (publication_status = 'draft' AND published_at IS NULL)
    OR (publication_status = 'published' AND published_at IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS app_changelog_entries_idempotency_uidx
  ON public.app_changelog_entries (created_by, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

DROP POLICY IF EXISTS app_changelog_entries_select_published ON public.app_changelog_entries;

CREATE POLICY app_changelog_entries_select_published ON public.app_changelog_entries
  FOR SELECT TO anon, authenticated
  USING (
    publication_status = 'published'
    AND published_at IS NOT NULL
    AND published_at <= now()
  );

REVOKE INSERT, UPDATE, DELETE ON public.app_changelog_entries FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.create_app_changelog_entry(uuid, text, text);
DROP FUNCTION IF EXISTS public.create_app_changelog_entry(uuid, text, text, boolean);
DROP FUNCTION IF EXISTS public.create_app_changelog_entry(uuid, text, text, boolean, text);

CREATE OR REPLACE FUNCTION public.create_app_changelog_entry(
  p_admin_user_id uuid,
  p_title text,
  p_body text,
  p_publish boolean DEFAULT false,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  v_id uuid;
  v_actor uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
BEGIN
  v_actor := public.require_admin_user_id(p_admin_user_id);

  IF v_key IS NOT NULL THEN
    SELECT e.id INTO v_id
    FROM public.app_changelog_entries e
    WHERE e.created_by = v_actor AND e.idempotency_key = v_key
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  IF char_length(v_title) < 4 OR char_length(v_title) > 80 THEN
    RAISE EXCEPTION 'Title must be between 4 and 80 characters';
  END IF;
  IF char_length(v_body) < 10 OR char_length(v_body) > 2000 THEN
    RAISE EXCEPTION 'Body must be between 10 and 2000 characters';
  END IF;

  IF coalesce(p_publish, false) THEN
    INSERT INTO public.app_changelog_entries (title, body, created_by, publication_status, published_at, idempotency_key)
    VALUES (v_title, v_body, v_actor, 'published', now(), v_key)
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.app_changelog_entries (title, body, created_by, publication_status, published_at, idempotency_key)
    VALUES (v_title, v_body, v_actor, 'draft', NULL, v_key)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.update_app_changelog_entry(uuid, uuid, text, text, boolean);

CREATE OR REPLACE FUNCTION public.update_app_changelog_entry(
  p_admin_user_id uuid,
  p_entry_id uuid,
  p_title text DEFAULT NULL,
  p_body text DEFAULT NULL,
  p_publish boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  v_id uuid;
  v_title text;
  v_body text;
  v_row public.app_changelog_entries%ROWTYPE;
BEGIN
  PERFORM public.require_admin_user_id(p_admin_user_id);

  SELECT * INTO v_row FROM public.app_changelog_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Changelog entry not found';
  END IF;

  v_title := coalesce(nullif(btrim(p_title), ''), v_row.title);
  v_body := coalesce(nullif(btrim(p_body), ''), v_row.body);

  IF char_length(v_title) < 4 OR char_length(v_title) > 80 THEN
    RAISE EXCEPTION 'Title must be between 4 and 80 characters';
  END IF;
  IF char_length(v_body) < 10 OR char_length(v_body) > 2000 THEN
    RAISE EXCEPTION 'Body must be between 10 and 2000 characters';
  END IF;

  UPDATE public.app_changelog_entries
  SET
    title = v_title,
    body = v_body,
    publication_status = CASE
      WHEN p_publish IS TRUE AND v_row.publication_status = 'draft' THEN 'published'
      WHEN p_publish IS FALSE THEN 'draft'
      ELSE v_row.publication_status
    END,
    published_at = CASE
      WHEN p_publish IS TRUE AND v_row.publication_status = 'draft' THEN now()
      WHEN p_publish IS FALSE THEN NULL
      ELSE v_row.published_at
    END
  WHERE id = p_entry_id
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.list_app_changelog_entries();

CREATE OR REPLACE FUNCTION public.list_app_changelog_entries()
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  published_at timestamptz,
  created_at timestamptz,
  publication_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT e.id, e.title, e.body, e.published_at, e.created_at, e.publication_status
  FROM public.app_changelog_entries e
  ORDER BY coalesce(e.published_at, e.created_at) DESC, e.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.list_public_app_changelog_entries()
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  published_at timestamptz,
  created_at timestamptz,
  publication_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT e.id, e.title, e.body, e.published_at, e.created_at, e.publication_status
  FROM public.app_changelog_entries e
  WHERE e.publication_status = 'published'
    AND e.published_at IS NOT NULL
    AND e.published_at <= now()
  ORDER BY e.published_at DESC, e.created_at DESC
  LIMIT 100;
$function$;

DROP FUNCTION IF EXISTS public.reorder_app_roadmap_items(uuid[]);
DROP FUNCTION IF EXISTS public.reorder_app_roadmap_items(uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.reorder_app_roadmap_items(
  p_admin_user_id uuid,
  p_ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  v_id uuid;
  v_index integer := 0;
BEGIN
  PERFORM public.require_admin_user_id(p_admin_user_id);

  IF p_ordered_ids IS NULL OR array_length(p_ordered_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Missing order';
  END IF;

  FOREACH v_id IN ARRAY p_ordered_ids LOOP
    UPDATE public.app_roadmap_items
    SET sort_order = v_index
    WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Roadmap item not found';
    END IF;
    v_index := v_index + 1;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_app_changelog_entry(uuid, text, text, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_app_changelog_entry(uuid, text, text, boolean, text) TO service_role;

REVOKE ALL ON FUNCTION public.update_app_changelog_entry(uuid, uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_app_changelog_entry(uuid, uuid, text, text, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.list_app_changelog_entries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_app_changelog_entries() TO service_role;

REVOKE ALL ON FUNCTION public.list_public_app_changelog_entries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_app_changelog_entries() TO service_role;

REVOKE ALL ON FUNCTION public.reorder_app_roadmap_items(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_app_roadmap_items(uuid, uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
