-- Hearing follow + draft engagement for deadline alerts (dry-run: SELECT 1 FROM public.hearing_user_interest LIMIT 0).
-- Manual apply via Coolify Expert. Run as postgres.

CREATE TABLE IF NOT EXISTS public.hearing_user_interest (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  stortinget_hearing_id text NOT NULL,
  followed_at timestamptz,
  draft_opened_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, stortinget_hearing_id),
  CONSTRAINT hearing_user_interest_hearing_id_nonempty CHECK (char_length(btrim(stortinget_hearing_id)) > 0),
  CONSTRAINT hearing_user_interest_has_signal CHECK (
    followed_at IS NOT NULL OR draft_opened_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS hearing_user_interest_hearing_idx
  ON public.hearing_user_interest (stortinget_hearing_id)
  WHERE followed_at IS NOT NULL OR draft_opened_at IS NOT NULL;

ALTER TABLE public.hearing_user_interest ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hearing_user_interest FROM PUBLIC;
REVOKE ALL ON TABLE public.hearing_user_interest FROM anon;
REVOKE ALL ON TABLE public.hearing_user_interest FROM authenticated;

GRANT SELECT ON TABLE public.hearing_user_interest TO authenticated;
GRANT ALL ON TABLE public.hearing_user_interest TO service_role;

DROP POLICY IF EXISTS hearing_user_interest_select_own ON public.hearing_user_interest;
CREATE POLICY hearing_user_interest_select_own
  ON public.hearing_user_interest
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_hearing_user_interest(
  p_user_id uuid,
  p_stortinget_hearing_id text,
  p_follow boolean DEFAULT NULL,
  p_draft_opened boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_hearing_id text;
  v_now timestamptz := now();
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);

  v_hearing_id := btrim(COALESCE(p_stortinget_hearing_id, ''));
  IF char_length(v_hearing_id) < 1 THEN
    RAISE EXCEPTION 'Invalid hearing id';
  END IF;

  IF p_follow IS NOT TRUE AND p_draft_opened IS NOT TRUE AND p_follow IS NOT FALSE THEN
    RAISE EXCEPTION 'Nothing to update';
  END IF;

  IF p_follow IS FALSE AND COALESCE(p_draft_opened, FALSE) IS NOT TRUE THEN
    UPDATE public.hearing_user_interest
    SET followed_at = NULL, updated_at = v_now
    WHERE user_id = p_user_id AND stortinget_hearing_id = v_hearing_id;

    DELETE FROM public.hearing_user_interest
    WHERE user_id = p_user_id
      AND stortinget_hearing_id = v_hearing_id
      AND followed_at IS NULL
      AND draft_opened_at IS NULL;
    RETURN;
  END IF;

  INSERT INTO public.hearing_user_interest (user_id, stortinget_hearing_id, followed_at, draft_opened_at, updated_at)
  VALUES (
    p_user_id,
    v_hearing_id,
    CASE WHEN p_follow IS TRUE THEN v_now WHEN p_follow IS FALSE THEN NULL ELSE NULL END,
    CASE WHEN p_draft_opened IS TRUE THEN v_now ELSE NULL END,
    v_now
  )
  ON CONFLICT (user_id, stortinget_hearing_id) DO UPDATE
  SET
    followed_at = CASE
      WHEN p_follow IS TRUE THEN v_now
      WHEN p_follow IS FALSE THEN NULL
      ELSE public.hearing_user_interest.followed_at
    END,
    draft_opened_at = CASE
      WHEN p_draft_opened IS TRUE THEN v_now
      ELSE public.hearing_user_interest.draft_opened_at
    END,
    updated_at = v_now;

  DELETE FROM public.hearing_user_interest
  WHERE user_id = p_user_id
    AND stortinget_hearing_id = v_hearing_id
    AND followed_at IS NULL
    AND draft_opened_at IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_hearing_user_interest(uuid, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_hearing_user_interest(uuid, text, boolean, boolean) TO service_role;