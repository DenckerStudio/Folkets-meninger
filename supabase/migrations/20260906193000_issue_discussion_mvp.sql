-- Sak-scoped discussion (Diskusjon MVP): one room per sak, flat posts.
-- Mirrors hearing_comments patterns; no revival of forum_* tables.

-- ---------------------------------------------------------------------------
-- 1) Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.issue_discussions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  stortinget_issue_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT issue_discussions_issue_id_unique UNIQUE (stortinget_issue_id)
);

CREATE INDEX IF NOT EXISTS issue_discussions_issue_id_idx
  ON public.issue_discussions (stortinget_issue_id);

CREATE TABLE IF NOT EXISTS public.issue_discussion_posts (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  discussion_id uuid NOT NULL REFERENCES public.issue_discussions (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  parent_post_id uuid REFERENCES public.issue_discussion_posts (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 4000),
  is_removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS issue_discussion_posts_discussion_created_idx
  ON public.issue_discussion_posts (discussion_id, created_at DESC);

CREATE INDEX IF NOT EXISTS issue_discussion_posts_author_idx
  ON public.issue_discussion_posts (author_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'other',
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_reports_target_unique UNIQUE (reporter_user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS content_reports_target_idx
  ON public.content_reports (target_type, target_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2) RLS (public read for visible posts; writes via service_role RPCs only)
-- ---------------------------------------------------------------------------
ALTER TABLE public.issue_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_discussion_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS issue_discussions_select ON public.issue_discussions;
CREATE POLICY issue_discussions_select ON public.issue_discussions
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS issue_discussion_posts_select ON public.issue_discussion_posts;
CREATE POLICY issue_discussion_posts_select ON public.issue_discussion_posts
  FOR SELECT TO anon, authenticated
  USING (NOT is_removed);

DROP POLICY IF EXISTS content_reports_select_own ON public.content_reports;
CREATE POLICY content_reports_select_own ON public.content_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_user_id);

-- ---------------------------------------------------------------------------
-- 3) RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_issue_discussion(p_issue_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_issue_id text := btrim(coalesce(p_issue_id, ''));
  v_discussion_id uuid;
BEGIN
  IF char_length(v_issue_id) < 1 THEN
    RAISE EXCEPTION 'Issue id required';
  END IF;

  SELECT id INTO v_discussion_id
  FROM public.issue_discussions
  WHERE stortinget_issue_id = v_issue_id;

  IF v_discussion_id IS NOT NULL THEN
    RETURN v_discussion_id;
  END IF;

  INSERT INTO public.issue_discussions (stortinget_issue_id)
  VALUES (v_issue_id)
  ON CONFLICT (stortinget_issue_id) DO UPDATE
    SET stortinget_issue_id = EXCLUDED.stortinget_issue_id
  RETURNING id INTO v_discussion_id;

  RETURN v_discussion_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_issue_discussion_post(
  p_user_id uuid,
  p_issue_id text,
  p_body text,
  p_parent_post_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_post_id uuid;
  v_body text;
  v_discussion_id uuid;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_public_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before posting';
  END IF;

  IF p_parent_post_id IS NOT NULL THEN
    RAISE EXCEPTION 'Nested replies are not supported yet';
  END IF;

  v_body := btrim(p_body);
  IF char_length(v_body) < 1 OR char_length(v_body) > 4000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 4000 characters';
  END IF;

  v_discussion_id := public.ensure_issue_discussion(p_issue_id);

  INSERT INTO public.issue_discussion_posts (
    discussion_id,
    author_user_id,
    parent_post_id,
    body
  )
  VALUES (v_discussion_id, p_user_id, NULL, v_body)
  RETURNING id INTO v_post_id;

  RETURN v_post_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.report_content(
  p_reporter_user_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_category text DEFAULT 'other',
  p_details text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_report_id uuid;
  v_target_type text := btrim(coalesce(p_target_type, ''));
  v_category text := btrim(coalesce(p_category, 'other'));
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
BEGIN
  PERFORM public.ensure_public_user(p_reporter_user_id);

  IF char_length(v_target_type) < 1 THEN
    RAISE EXCEPTION 'Target type required';
  END IF;

  IF p_target_id IS NULL THEN
    RAISE EXCEPTION 'Target id required';
  END IF;

  IF v_target_type = 'issue_discussion_post' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.issue_discussion_posts p
      WHERE p.id = p_target_id
        AND NOT p.is_removed
    ) THEN
      RAISE EXCEPTION 'Post not found';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported target type';
  END IF;

  INSERT INTO public.content_reports (
    reporter_user_id,
    target_type,
    target_id,
    category,
    details
  )
  VALUES (
    p_reporter_user_id,
    v_target_type,
    p_target_id,
    v_category,
    v_details
  )
  ON CONFLICT (reporter_user_id, target_type, target_id) DO UPDATE
    SET category = EXCLUDED.category,
        details = EXCLUDED.details,
        created_at = now()
  RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_issue_discussion(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_issue_discussion_post(uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_content(uuid, text, uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ensure_issue_discussion(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_issue_discussion_post(uuid, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.report_content(uuid, text, uuid, text, text) TO service_role;
