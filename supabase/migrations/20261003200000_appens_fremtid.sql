-- Appens fremtid: richer forslag, admin-controlled voting, changelog, roadmap.
-- Not applied in this change.

ALTER TABLE public.app_suggestions
  ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.app_suggestions
  ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.app_suggestions
  ADD COLUMN IF NOT EXISTS audience text;

ALTER TABLE public.app_suggestions
  ADD COLUMN IF NOT EXISTS voting_open boolean NOT NULL DEFAULT false;

UPDATE public.app_suggestions
SET title = CASE
  WHEN char_length(btrim(body)) >= 8 THEN left(btrim(body), 80)
  ELSE 'Forslag'
END
WHERE title IS NULL OR btrim(title) = '';

UPDATE public.app_suggestions
SET category = 'annet'
WHERE category IS NULL OR btrim(category) = '';

UPDATE public.app_suggestions
SET audience = 'alle'
WHERE audience IS NULL OR btrim(audience) = '';

ALTER TABLE public.app_suggestions
  ALTER COLUMN title SET NOT NULL;

ALTER TABLE public.app_suggestions
  ALTER COLUMN category SET NOT NULL;

ALTER TABLE public.app_suggestions
  ALTER COLUMN audience SET NOT NULL;

ALTER TABLE public.app_suggestions
  DROP CONSTRAINT IF EXISTS app_suggestions_body_check;

ALTER TABLE public.app_suggestions
  ADD CONSTRAINT app_suggestions_body_check
  CHECK (char_length(body) >= 10 AND char_length(body) <= 800);

ALTER TABLE public.app_suggestions
  DROP CONSTRAINT IF EXISTS app_suggestions_title_check;

ALTER TABLE public.app_suggestions
  ADD CONSTRAINT app_suggestions_title_check
  CHECK (char_length(title) >= 8 AND char_length(title) <= 80);

ALTER TABLE public.app_suggestions
  DROP CONSTRAINT IF EXISTS app_suggestions_category_check;

ALTER TABLE public.app_suggestions
  ADD CONSTRAINT app_suggestions_category_check
  CHECK (category IN ('funksjon', 'innhold', 'feil', 'annet'));

ALTER TABLE public.app_suggestions
  DROP CONSTRAINT IF EXISTS app_suggestions_audience_check;

ALTER TABLE public.app_suggestions
  ADD CONSTRAINT app_suggestions_audience_check
  CHECK (audience IN ('alle', 'innloggede', 'admin', 'meg'));

CREATE TABLE IF NOT EXISTS public.app_suggestion_votes (
  suggestion_id uuid NOT NULL REFERENCES public.app_suggestions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('up', 'down')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (suggestion_id, user_id)
);

CREATE INDEX IF NOT EXISTS app_suggestion_votes_suggestion_idx
  ON public.app_suggestion_votes (suggestion_id, vote);

ALTER TABLE public.app_suggestion_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_suggestion_votes_service ON public.app_suggestion_votes;
CREATE POLICY app_suggestion_votes_service ON public.app_suggestion_votes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_suggestion_votes TO service_role;

CREATE TABLE IF NOT EXISTS public.app_changelog_entries (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) >= 4 AND char_length(title) <= 80),
  body text NOT NULL CHECK (char_length(body) >= 10 AND char_length(body) <= 2000),
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_changelog_entries_published_idx
  ON public.app_changelog_entries (published_at DESC);

ALTER TABLE public.app_changelog_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_changelog_entries_service ON public.app_changelog_entries;
CREATE POLICY app_changelog_entries_service ON public.app_changelog_entries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, DELETE ON public.app_changelog_entries TO service_role;

CREATE TABLE IF NOT EXISTS public.app_roadmap_items (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) >= 4 AND char_length(title) <= 80),
  body text NOT NULL CHECK (char_length(body) >= 10 AND char_length(body) <= 1000),
  status text NOT NULL CHECK (status IN ('planned', 'in_progress', 'done')),
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_roadmap_items_status_sort_idx
  ON public.app_roadmap_items (status, sort_order, created_at DESC);

ALTER TABLE public.app_roadmap_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_roadmap_items_service ON public.app_roadmap_items;
CREATE POLICY app_roadmap_items_service ON public.app_roadmap_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_roadmap_items TO service_role;

CREATE OR REPLACE FUNCTION public.app_future_require_admin(p_admin_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF p_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing admin id';
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
END;
$function$;

REVOKE ALL ON FUNCTION public.app_future_require_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_future_require_admin(uuid) TO service_role;

DROP FUNCTION IF EXISTS public.create_app_suggestion(uuid, text);

CREATE OR REPLACE FUNCTION public.create_app_suggestion(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_category text,
  p_audience text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_category text := btrim(coalesce(p_category, ''));
  v_audience text := btrim(coalesce(p_audience, ''));
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF char_length(v_title) < 8 OR char_length(v_title) > 80 THEN
    RAISE EXCEPTION 'Title must be between 8 and 80 characters';
  END IF;

  IF char_length(v_body) < 20 OR char_length(v_body) > 800 THEN
    RAISE EXCEPTION 'Suggestion must be between 20 and 800 characters';
  END IF;

  IF v_category NOT IN ('funksjon', 'innhold', 'feil', 'annet') THEN
    RAISE EXCEPTION 'Invalid suggestion category';
  END IF;

  IF v_audience NOT IN ('alle', 'innloggede', 'admin', 'meg') THEN
    RAISE EXCEPTION 'Invalid suggestion audience';
  END IF;

  INSERT INTO public.app_suggestions (user_id, title, body, category, audience)
  VALUES (p_user_id, v_title, v_body, v_category, v_audience)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_app_suggestion(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_app_suggestion(uuid, text, text, text, text) TO service_role;

DROP FUNCTION IF EXISTS public.list_app_suggestions(text, integer);

CREATE OR REPLACE FUNCTION public.list_app_suggestions(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  body text,
  category text,
  audience text,
  status text,
  voting_open boolean,
  created_at timestamptz,
  handled_at timestamptz,
  handled_by uuid,
  author_name text,
  up_count bigint,
  down_count bigint
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
    s.title,
    s.body,
    s.category,
    s.audience,
    s.status,
    s.voting_open,
    s.created_at,
    s.handled_at,
    s.handled_by,
    nullif(btrim(concat_ws(' ', u.first_name, u.last_name)), ''),
    (SELECT count(*) FROM public.app_suggestion_votes v WHERE v.suggestion_id = s.id AND v.vote = 'up'),
    (SELECT count(*) FROM public.app_suggestion_votes v WHERE v.suggestion_id = s.id AND v.vote = 'down')
  FROM public.app_suggestions s
  LEFT JOIN public.users u ON u.id = s.user_id
  WHERE v_status IS NULL OR s.status = v_status
  ORDER BY s.created_at DESC
  LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_app_suggestions(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_app_suggestions(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.set_app_suggestion_voting(
  p_suggestion_id uuid,
  p_admin_user_id uuid,
  p_voting_open boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.app_future_require_admin(p_admin_user_id);

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

REVOKE ALL ON FUNCTION public.set_app_suggestion_voting(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_app_suggestion_voting(uuid, uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.list_voting_app_suggestions(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  body text,
  category text,
  audience text,
  status text,
  voting_open boolean,
  created_at timestamptz,
  handled_at timestamptz,
  handled_by uuid,
  author_name text,
  up_count bigint,
  down_count bigint,
  my_vote text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.title,
    s.body,
    s.category,
    s.audience,
    s.status,
    s.voting_open,
    s.created_at,
    s.handled_at,
    s.handled_by,
    nullif(btrim(concat_ws(' ', u.first_name, u.last_name)), ''),
    (SELECT count(*) FROM public.app_suggestion_votes v WHERE v.suggestion_id = s.id AND v.vote = 'up'),
    (SELECT count(*) FROM public.app_suggestion_votes v WHERE v.suggestion_id = s.id AND v.vote = 'down'),
    (
      SELECT v.vote
      FROM public.app_suggestion_votes v
      WHERE v.suggestion_id = s.id AND v.user_id = p_user_id
      LIMIT 1
    )
  FROM public.app_suggestions s
  LEFT JOIN public.users u ON u.id = s.user_id
  WHERE s.voting_open = true
  ORDER BY s.created_at DESC
  LIMIT 100;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_voting_app_suggestions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_voting_app_suggestions(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cast_app_suggestion_vote(
  p_user_id uuid,
  p_suggestion_id uuid,
  p_vote text
)
RETURNS TABLE (
  up_count bigint,
  down_count bigint,
  my_vote text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_vote text := btrim(coalesce(p_vote, ''));
  v_open boolean;
BEGIN
  IF p_user_id IS NULL OR p_suggestion_id IS NULL THEN
    RAISE EXCEPTION 'Missing user or suggestion id';
  END IF;

  IF v_vote NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'Invalid vote';
  END IF;

  PERFORM public.ensure_public_user(p_user_id);

  SELECT s.voting_open INTO v_open
  FROM public.app_suggestions s
  WHERE s.id = p_suggestion_id;

  IF v_open IS NULL THEN
    RAISE EXCEPTION 'Suggestion not found';
  END IF;

  IF v_open IS NOT TRUE THEN
    RAISE EXCEPTION 'Voting is closed';
  END IF;

  INSERT INTO public.app_suggestion_votes (suggestion_id, user_id, vote)
  VALUES (p_suggestion_id, p_user_id, v_vote)
  ON CONFLICT (suggestion_id, user_id)
  DO UPDATE SET vote = EXCLUDED.vote, updated_at = now();

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.app_suggestion_votes v WHERE v.suggestion_id = p_suggestion_id AND v.vote = 'up'),
    (SELECT count(*) FROM public.app_suggestion_votes v WHERE v.suggestion_id = p_suggestion_id AND v.vote = 'down'),
    v_vote;
END;
$function$;

REVOKE ALL ON FUNCTION public.cast_app_suggestion_vote(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cast_app_suggestion_vote(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.list_app_changelog_entries()
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  published_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT e.id, e.title, e.body, e.published_at, e.created_at
  FROM public.app_changelog_entries e
  ORDER BY e.published_at DESC, e.created_at DESC
  LIMIT 100;
$function$;

REVOKE ALL ON FUNCTION public.list_app_changelog_entries() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_app_changelog_entries() TO service_role;

CREATE OR REPLACE FUNCTION public.create_app_changelog_entry(
  p_admin_user_id uuid,
  p_title text,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
BEGIN
  PERFORM public.app_future_require_admin(p_admin_user_id);

  IF char_length(v_title) < 4 OR char_length(v_title) > 80 THEN
    RAISE EXCEPTION 'Title must be between 4 and 80 characters';
  END IF;
  IF char_length(v_body) < 10 OR char_length(v_body) > 2000 THEN
    RAISE EXCEPTION 'Body must be between 10 and 2000 characters';
  END IF;

  INSERT INTO public.app_changelog_entries (title, body, created_by)
  VALUES (v_title, v_body, p_admin_user_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_app_changelog_entry(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_app_changelog_entry(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_app_changelog_entry(
  p_admin_user_id uuid,
  p_entry_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.app_future_require_admin(p_admin_user_id);

  DELETE FROM public.app_changelog_entries
  WHERE id = p_entry_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Changelog entry not found';
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_app_changelog_entry(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_app_changelog_entry(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.list_app_roadmap_items()
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  status text,
  sort_order integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT i.id, i.title, i.body, i.status, i.sort_order, i.created_at
  FROM public.app_roadmap_items i
  ORDER BY
    CASE i.status
      WHEN 'in_progress' THEN 0
      WHEN 'planned' THEN 1
      ELSE 2
    END,
    i.sort_order,
    i.created_at DESC
  LIMIT 100;
$function$;

REVOKE ALL ON FUNCTION public.list_app_roadmap_items() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_app_roadmap_items() TO service_role;

CREATE OR REPLACE FUNCTION public.create_app_roadmap_item(
  p_admin_user_id uuid,
  p_title text,
  p_body text,
  p_status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_status text := btrim(coalesce(p_status, ''));
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

  INSERT INTO public.app_roadmap_items (title, body, status, created_by)
  VALUES (v_title, v_body, v_status, p_admin_user_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_app_roadmap_item(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_app_roadmap_item(uuid, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_app_roadmap_item_status(
  p_admin_user_id uuid,
  p_item_id uuid,
  p_status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_id uuid;
  v_status text := btrim(coalesce(p_status, ''));
BEGIN
  PERFORM public.app_future_require_admin(p_admin_user_id);

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

REVOKE ALL ON FUNCTION public.set_app_roadmap_item_status(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_app_roadmap_item_status(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_app_roadmap_item(
  p_admin_user_id uuid,
  p_item_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.app_future_require_admin(p_admin_user_id);

  DELETE FROM public.app_roadmap_items
  WHERE id = p_item_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Roadmap item not found';
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_app_roadmap_item(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_app_roadmap_item(uuid, uuid) TO service_role;
