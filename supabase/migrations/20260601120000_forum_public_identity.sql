-- Forum public identity: first_name + last_name, no anonymous human posts

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- Backfill from name where possible (simple split on first space)
UPDATE public.users
SET
  first_name = COALESCE(
    first_name,
    NULLIF(split_part(trim(name), ' ', 1), '')
  ),
  last_name = COALESCE(
    last_name,
    NULLIF(
      trim(substring(trim(name) from position(' ' in trim(name)) + 1)),
      ''
    )
  )
WHERE name IS NOT NULL AND trim(name) <> '';

UPDATE public.users
SET name = trim(concat_ws(' ', first_name, last_name))
WHERE first_name IS NOT NULL
  AND last_name IS NOT NULL
  AND char_length(trim(first_name)) >= 2
  AND char_length(trim(last_name)) >= 2;

CREATE OR REPLACE FUNCTION public.user_has_forum_identity(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND char_length(trim(coalesce(u.first_name, ''))) >= 2
      AND char_length(trim(coalesce(u.last_name, ''))) >= 2
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_forum_identity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_forum_identity(uuid) TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_public_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_email text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found in auth.users';
  END IF;

  SELECT
    NULLIF(trim(raw_user_meta_data->>'first_name'), ''),
    NULLIF(trim(raw_user_meta_data->>'last_name'), ''),
    NULLIF(trim(raw_user_meta_data->>'full_name'), ''),
    email
  INTO v_first_name, v_last_name, v_full_name, v_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_first_name IS NULL AND v_last_name IS NULL AND v_full_name IS NOT NULL THEN
    v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
    v_last_name := NULLIF(trim(substring(v_full_name from position(' ' in v_full_name) + 1)), '');
  END IF;

  INSERT INTO public.users (id, first_name, last_name, name, email)
  VALUES (
    p_user_id,
    v_first_name,
    v_last_name,
    CASE
      WHEN v_first_name IS NOT NULL AND v_last_name IS NOT NULL
        AND char_length(v_first_name) >= 2 AND char_length(v_last_name) >= 2
      THEN trim(v_first_name || ' ' || v_last_name)
      ELSE v_full_name
    END,
    v_email
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, public.users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.users.last_name),
    name = CASE
      WHEN EXCLUDED.first_name IS NOT NULL AND EXCLUDED.last_name IS NOT NULL
        AND char_length(EXCLUDED.first_name) >= 2 AND char_length(EXCLUDED.last_name) >= 2
      THEN trim(EXCLUDED.first_name || ' ' || EXCLUDED.last_name)
      ELSE COALESCE(public.users.name, EXCLUDED.name)
    END,
    email = COALESCE(EXCLUDED.email, public.users.email);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_profile_names(
  p_user_id uuid,
  p_first_name text,
  p_last_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_first text;
  v_last text;
BEGIN
  v_first := trim(p_first_name);
  v_last := trim(p_last_name);

  IF char_length(v_first) < 2 OR char_length(v_last) < 2 THEN
    RAISE EXCEPTION 'Fornavn og etternavn må være minst 2 tegn';
  END IF;

  PERFORM public.ensure_public_user(p_user_id);

  UPDATE public.users
  SET
    first_name = v_first,
    last_name = v_last,
    name = trim(v_first || ' ' || v_last)
  WHERE id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_user_profile_names(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_profile_names(uuid, text, text) TO service_role;

ALTER TABLE public.forum_threads
  DROP CONSTRAINT IF EXISTS forum_threads_author_check;

ALTER TABLE public.forum_threads
  ADD CONSTRAINT forum_threads_author_check
  CHECK (is_system_thread = true OR author_user_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.create_forum_thread(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_stortinget_issue_id text DEFAULT NULL,
  p_context_items jsonb DEFAULT '[]'::jsonb,
  p_is_system_thread boolean DEFAULT false
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
  IF NOT COALESCE(p_is_system_thread, false) THEN
    PERFORM public.ensure_public_user(p_user_id);
    IF NOT public.user_has_forum_identity(p_user_id) THEN
      RAISE EXCEPTION 'Complete your profile with first and last name before posting';
    END IF;
  END IF;

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

  INSERT INTO public.forum_threads (
    title, body, stortinget_issue_id, author_user_id, context_items, is_system_thread
  )
  VALUES (
    v_title, v_body, p_stortinget_issue_id, p_user_id,
    COALESCE(p_context_items, '[]'::jsonb),
    COALESCE(p_is_system_thread, false)
  )
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

  IF NOT public.user_has_forum_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before posting';
  END IF;

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

-- Hearing comments keyed by Stortinget hearing id (no hearings table required)
CREATE TABLE IF NOT EXISTS public.hearing_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stortinget_hearing_id text NOT NULL,
  body text NOT NULL,
  author_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hearing_comments
  ADD COLUMN IF NOT EXISTS stortinget_hearing_id text;

-- Legacy hearing_id uuid column: drop FK dependency on hearings if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hearing_comments' AND column_name = 'hearing_id'
  ) THEN
    ALTER TABLE public.hearing_comments DROP COLUMN IF EXISTS hearing_id;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS hearing_comments_stortinget_id_idx
  ON public.hearing_comments (stortinget_hearing_id, created_at);

ALTER TABLE public.hearing_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hearing_comments_select ON public.hearing_comments;
CREATE POLICY hearing_comments_select ON public.hearing_comments FOR SELECT USING (true);

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

  IF NOT public.user_has_forum_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before posting';
  END IF;

  v_body := btrim(p_body);
  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  IF p_stortinget_hearing_id IS NULL OR char_length(trim(p_stortinget_hearing_id)) < 1 THEN
    RAISE EXCEPTION 'Invalid hearing id';
  END IF;

  INSERT INTO public.hearing_comments (stortinget_hearing_id, body, author_user_id)
  VALUES (trim(p_stortinget_hearing_id), v_body, p_user_id)
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_hearing_comment(uuid, text, text) TO service_role;

-- Forum reports (moderation queue)
CREATE TABLE IF NOT EXISTS public.forum_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('thread', 'reply')),
  target_id uuid NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_reports_status_idx ON public.forum_reports (status, created_at DESC);

ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forum_reports_insert ON public.forum_reports;
CREATE POLICY forum_reports_insert ON public.forum_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

DROP POLICY IF EXISTS forum_reports_select_own ON public.forum_reports;
CREATE POLICY forum_reports_select_own ON public.forum_reports
  FOR SELECT USING (auth.uid() = reporter_user_id);
