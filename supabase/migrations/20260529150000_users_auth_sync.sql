-- Sync public.users with Supabase Auth (auth.users), not legacy next_auth.users

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.ensure_public_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_name text;
  v_email text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found in auth.users';
  END IF;

  SELECT
    COALESCE(
      NULLIF(trim(raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(raw_user_meta_data->>'name'), ''),
      NULLIF(trim(raw_user_meta_data->>'user_name'), ''),
      NULLIF(split_part(email, '@', 1), '')
    ),
    email
  INTO v_name, v_email
  FROM auth.users
  WHERE id = p_user_id;

  INSERT INTO public.users (id, name, email)
  VALUES (p_user_id, v_name, v_email)
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, public.users.name),
    email = COALESCE(EXCLUDED.email, public.users.email);
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_public_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_public_user(uuid) TO service_role;

-- Forum RPCs: ensure profile exists before write
CREATE OR REPLACE FUNCTION public.create_forum_thread(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_stortinget_issue_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_thread_id uuid;
  v_title text;
  v_body text;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  v_title := btrim(p_title);
  v_body := btrim(p_body);

  IF char_length(v_title) < 3 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 3 and 200 characters';
  END IF;

  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  IF p_stortinget_issue_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.stortinget_issues WHERE id = p_stortinget_issue_id
  ) THEN
    RAISE EXCEPTION 'Unknown stortinget issue';
  END IF;

  INSERT INTO public.forum_threads (title, body, stortinget_issue_id, author_user_id)
  VALUES (v_title, v_body, p_stortinget_issue_id, p_user_id)
  RETURNING id INTO v_thread_id;

  RETURN v_thread_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_forum_reply(
  p_user_id uuid,
  p_thread_id uuid,
  p_body text,
  p_parent_reply_id uuid DEFAULT NULL,
  p_is_official_response boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_reply_id uuid;
  v_body text;
  v_is_official boolean;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF p_parent_reply_id IS NOT NULL THEN
    RAISE EXCEPTION 'Nested replies are not supported';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.forum_threads WHERE id = p_thread_id) THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  v_body := btrim(p_body);

  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  v_is_official := COALESCE(p_is_official_response, false);

  IF v_is_official AND NOT EXISTS (
    SELECT 1 FROM public.politician_profiles WHERE user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Only verified politicians can post official responses';
  END IF;

  INSERT INTO public.forum_replies (thread_id, body, author_user_id, parent_reply_id, is_official_response)
  VALUES (p_thread_id, v_body, p_user_id, NULL, v_is_official)
  RETURNING id INTO v_reply_id;

  IF v_is_official THEN
    UPDATE public.forum_threads
    SET is_resolved = true
    WHERE id = p_thread_id;
  END IF;

  RETURN v_reply_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_forum_like(
  p_user_id uuid,
  p_target_type text,
  p_target_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_exists boolean;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF p_target_type NOT IN ('thread', 'reply') THEN
    RAISE EXCEPTION 'Invalid target type';
  END IF;

  IF p_target_type = 'thread' THEN
    IF NOT EXISTS (SELECT 1 FROM public.forum_threads WHERE id = p_target_id) THEN
      RAISE EXCEPTION 'Thread not found';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.forum_replies WHERE id = p_target_id) THEN
      RAISE EXCEPTION 'Reply not found';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.forum_likes
    WHERE user_id = p_user_id
      AND target_type = p_target_type
      AND target_id = p_target_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.forum_likes
    WHERE user_id = p_user_id
      AND target_type = p_target_type
      AND target_id = p_target_id;
    RETURN false;
  ELSE
    INSERT INTO public.forum_likes (user_id, target_type, target_id)
    VALUES (p_user_id, p_target_type, p_target_id);
    RETURN true;
  END IF;
END;
$function$;

-- Hearing comments use the same public.users FK
CREATE OR REPLACE FUNCTION public.create_hearing_comment(
  p_user_id uuid,
  p_hearing_id uuid,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_comment_id uuid;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.hearing_comments (hearing_id, body, author_user_id)
  VALUES (p_hearing_id, p_body, p_user_id)
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_hearing_comment(uuid, uuid, text) TO service_role;
