-- Enable one-tap Enig/Uenig (empty body) for citizen opinion replies.
-- The existing constraint and RPC require 80+ characters for 'for'/'imot' stances.
-- This migration allows empty body when stance is 'for' or 'imot' (quick stance),
-- while keeping the 80-char minimum when a body is provided.
-- Must be applied manually (paste into Supabase SQL editor or run via supabase db push).

ALTER TABLE public.citizen_opinion_replies
  DROP CONSTRAINT IF EXISTS citizen_opinion_replies_body_len;

ALTER TABLE public.citizen_opinion_replies
  ADD CONSTRAINT citizen_opinion_replies_body_len CHECK (
    char_length(body) <= 4000
    AND (
      stance = 'blank'
      OR (stance IN ('for','imot') AND char_length(btrim(body)) = 0)
      OR char_length(btrim(body)) >= 80
    )
  );

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
AS $$
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

  IF v_stance NOT IN ('for', 'blank', 'imot') THEN
    RAISE EXCEPTION 'Invalid stance';
  END IF;

  IF char_length(v_body) > 4000 THEN
    RAISE EXCEPTION 'Body must be at most 4000 characters';
  END IF;
  IF v_stance <> 'blank' AND char_length(v_body) > 0 AND char_length(v_body) < 80 THEN
    RAISE EXCEPTION 'Body must be between 80 and 4000 characters';
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
$$;

REVOKE ALL ON FUNCTION public.create_citizen_opinion_reply(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_citizen_opinion_reply(uuid, uuid, text, text) TO service_role;