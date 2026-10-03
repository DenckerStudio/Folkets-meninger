-- In-app product suggestions from logged-in users (replaces Fider Forslag).
-- Writes go through create_app_suggestion (service role). Not applied in this change.

CREATE TABLE IF NOT EXISTS public.app_suggestions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) >= 10 AND char_length(body) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_suggestions_user_created_idx
  ON public.app_suggestions (user_id, created_at DESC);

ALTER TABLE public.app_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_suggestions_service ON public.app_suggestions;
CREATE POLICY app_suggestions_service ON public.app_suggestions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.app_suggestions TO service_role;

CREATE OR REPLACE FUNCTION public.create_app_suggestion(
  p_user_id uuid,
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
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  v_body := btrim(p_body);
  IF char_length(v_body) < 10 OR char_length(v_body) > 500 THEN
    RAISE EXCEPTION 'Suggestion must be between 10 and 500 characters';
  END IF;

  INSERT INTO public.app_suggestions (user_id, body)
  VALUES (p_user_id, v_body)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_app_suggestion(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_app_suggestion(uuid, text) TO service_role;
