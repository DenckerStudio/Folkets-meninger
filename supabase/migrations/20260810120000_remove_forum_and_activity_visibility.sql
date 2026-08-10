-- Full forum removal (app code removed) + opt-in activity visibility.
-- No forum data export (product decision). Keep hearing_comments and voting.

-- ---------------------------------------------------------------------------
-- 1) Activity visibility (private by default)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS activity_visibility text NOT NULL DEFAULT 'private';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_activity_visibility_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_activity_visibility_check
      CHECK (activity_visibility IN ('private', 'summary', 'full'));
  END IF;
END $$;

COMMENT ON COLUMN public.users.activity_visibility IS
  'Opt-in public activity: private (default), summary, or full. Never exposes vote choices.';

-- ---------------------------------------------------------------------------
-- 2) Public identity helper (rename from forum-specific name)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_public_identity(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND length(trim(coalesce(u.first_name, ''))) >= 2
      AND length(trim(coalesce(u.last_name, ''))) >= 2
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_public_identity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_public_identity(uuid) TO service_role, authenticated;

-- Keep old name as thin wrapper for any remaining RPC references during rollout.
CREATE OR REPLACE FUNCTION public.user_has_forum_identity(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_public_identity(p_user_id);
$$;

-- Prefer public identity in hearing comment RPC when present.
CREATE OR REPLACE FUNCTION public.create_hearing_comment(
  p_user_id uuid,
  p_stortinget_hearing_id text,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_comment_id uuid;
  v_body text;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_public_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before posting';
  END IF;

  v_body := btrim(p_body);
  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  IF p_stortinget_hearing_id IS NULL OR char_length(trim(p_stortinget_hearing_id)) < 1 THEN
    RAISE EXCEPTION 'Hearing id required';
  END IF;

  INSERT INTO public.hearing_comments (stortinget_hearing_id, body, author_user_id)
  VALUES (trim(p_stortinget_hearing_id), v_body, p_user_id)
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_hearing_comment(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_hearing_comment(uuid, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Drop forum objects (CASCADE cleans FKs, triggers, dependent policies)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.forum_prompt_moderation_feedback CASCADE;
DROP TABLE IF EXISTS public.forum_research_articles CASCADE;
DROP TABLE IF EXISTS public.forum_research_clusters CASCADE;
DROP TABLE IF EXISTS public.forum_trusted_sources CASCADE;
DROP TABLE IF EXISTS public.forum_reports CASCADE;
DROP TABLE IF EXISTS public.forum_prompt_discuss_clicks CASCADE;
DROP TABLE IF EXISTS public.forum_prompt_votes CASCADE;
DROP TABLE IF EXISTS public.forum_prompts CASCADE;
DROP TABLE IF EXISTS public.forum_dislikes CASCADE;
DROP TABLE IF EXISTS public.forum_likes CASCADE;
DROP TABLE IF EXISTS public.forum_replies CASCADE;
DROP TABLE IF EXISTS public.forum_threads CASCADE;

-- Drop remaining forum RPCs/helpers (keep user_has_forum_identity wrapper).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS proc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE 'create_forum_%'
        OR p.proname LIKE 'toggle_forum_%'
        OR p.proname LIKE 'submit_forum_%'
        OR p.proname LIKE 'award_points_for_forum_%'
        OR p.proname LIKE 'forum_%'
        OR p.proname LIKE 'log_forum_%'
        OR p.proname = 'get_poll_top_arguments'
      )
      AND p.proname <> 'user_has_forum_identity'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.proc || ' CASCADE';
  END LOOP;
END $$;
