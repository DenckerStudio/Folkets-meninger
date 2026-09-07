-- Folkets meninger: citizen opinions linked to Stortinget saker, with
-- written For / Blank / Imot replies. Writes go through service-role RPCs.

-- ---------------------------------------------------------------------------
-- 1) Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.citizen_opinions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  author_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  stance text NOT NULL,
  stortinget_issue_id text,
  is_removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT citizen_opinions_title_len CHECK (char_length(btrim(title)) >= 5 AND char_length(title) <= 200),
  CONSTRAINT citizen_opinions_body_len CHECK (char_length(btrim(body)) >= 250 AND char_length(body) <= 4000),
  CONSTRAINT citizen_opinions_stance_check CHECK (stance IN ('for', 'blank', 'imot'))
);

CREATE INDEX IF NOT EXISTS citizen_opinions_created_idx
  ON public.citizen_opinions (created_at DESC)
  WHERE NOT is_removed;

CREATE INDEX IF NOT EXISTS citizen_opinions_author_idx
  ON public.citizen_opinions (author_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS citizen_opinions_issue_idx
  ON public.citizen_opinions (stortinget_issue_id, created_at DESC)
  WHERE stortinget_issue_id IS NOT NULL AND NOT is_removed;

CREATE TABLE IF NOT EXISTS public.citizen_opinion_replies (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  opinion_id uuid NOT NULL REFERENCES public.citizen_opinions (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  stance text NOT NULL,
  body text NOT NULL,
  is_removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT citizen_opinion_replies_body_len CHECK (char_length(btrim(body)) >= 80 AND char_length(body) <= 4000),
  CONSTRAINT citizen_opinion_replies_stance_check CHECK (stance IN ('for', 'blank', 'imot')),
  CONSTRAINT citizen_opinion_replies_one_per_user UNIQUE (opinion_id, author_user_id)
);

CREATE INDEX IF NOT EXISTS citizen_opinion_replies_opinion_created_idx
  ON public.citizen_opinion_replies (opinion_id, created_at DESC)
  WHERE NOT is_removed;

CREATE INDEX IF NOT EXISTS citizen_opinion_replies_author_idx
  ON public.citizen_opinion_replies (author_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2) RLS (public read for visible rows; writes via service_role RPCs only)
-- ---------------------------------------------------------------------------
ALTER TABLE public.citizen_opinions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citizen_opinion_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS citizen_opinions_select ON public.citizen_opinions;
CREATE POLICY citizen_opinions_select ON public.citizen_opinions
  FOR SELECT TO anon, authenticated
  USING (NOT is_removed);

DROP POLICY IF EXISTS citizen_opinion_replies_select ON public.citizen_opinion_replies;
CREATE POLICY citizen_opinion_replies_select ON public.citizen_opinion_replies
  FOR SELECT TO anon, authenticated
  USING (NOT is_removed);

-- ---------------------------------------------------------------------------
-- 3) RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_citizen_opinion(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_stance text,
  p_stortinget_issue_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_id uuid;
  v_title text;
  v_body text;
  v_stance text;
  v_issue_id text;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_public_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before posting';
  END IF;

  v_title := btrim(coalesce(p_title, ''));
  v_body := btrim(coalesce(p_body, ''));
  v_stance := btrim(coalesce(p_stance, ''));
  v_issue_id := nullif(btrim(coalesce(p_stortinget_issue_id, '')), '');

  IF char_length(v_title) < 5 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 5 and 200 characters';
  END IF;

  IF char_length(v_body) < 250 OR char_length(v_body) > 4000 THEN
    RAISE EXCEPTION 'Body must be between 250 and 4000 characters';
  END IF;

  IF v_stance NOT IN ('for', 'blank', 'imot') THEN
    RAISE EXCEPTION 'Invalid stance';
  END IF;

  INSERT INTO public.citizen_opinions (
    author_user_id,
    title,
    body,
    stance,
    stortinget_issue_id
  )
  VALUES (p_user_id, v_title, v_body, v_stance, v_issue_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_citizen_opinion_reply(
  p_user_id uuid,
  p_opinion_id uuid,
  p_stance text,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_id uuid;
  v_body text;
  v_stance text;
  v_author uuid;
  v_removed boolean;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_public_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before posting';
  END IF;

  IF p_opinion_id IS NULL THEN
    RAISE EXCEPTION 'Opinion id required';
  END IF;

  SELECT author_user_id, is_removed
    INTO v_author, v_removed
  FROM public.citizen_opinions
  WHERE id = p_opinion_id;

  IF v_author IS NULL THEN
    RAISE EXCEPTION 'Opinion not found';
  END IF;

  IF v_removed THEN
    RAISE EXCEPTION 'Opinion not found';
  END IF;

  IF v_author = p_user_id THEN
    RAISE EXCEPTION 'You cannot reply to your own opinion';
  END IF;

  v_body := btrim(coalesce(p_body, ''));
  v_stance := btrim(coalesce(p_stance, ''));

  IF char_length(v_body) < 80 OR char_length(v_body) > 4000 THEN
    RAISE EXCEPTION 'Body must be between 80 and 4000 characters';
  END IF;

  IF v_stance NOT IN ('for', 'blank', 'imot') THEN
    RAISE EXCEPTION 'Invalid stance';
  END IF;

  INSERT INTO public.citizen_opinion_replies (
    opinion_id,
    author_user_id,
    stance,
    body
  )
  VALUES (p_opinion_id, p_user_id, v_stance, v_body)
  ON CONFLICT (opinion_id, author_user_id) DO UPDATE
    SET stance = EXCLUDED.stance,
        body = EXCLUDED.body,
        is_removed = false,
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_citizen_opinion(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_citizen_opinion_reply(uuid, uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_citizen_opinion(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_citizen_opinion_reply(uuid, uuid, text, text) TO service_role;
