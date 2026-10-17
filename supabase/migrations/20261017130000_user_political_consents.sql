-- Art. 9: explicit consent for political data processing (versioned, withdrawable).

CREATE TABLE IF NOT EXISTS public.user_political_consents (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (
    purpose IN (
      'political_storage',
      'political_profiling',
      'political_byok_activity'
    )
  ),
  consent_text_version text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  PRIMARY KEY (user_id, purpose)
);

CREATE INDEX IF NOT EXISTS user_political_consents_active_idx
  ON public.user_political_consents (user_id)
  WHERE withdrawn_at IS NULL;

ALTER TABLE public.user_political_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_political_consents_select_own ON public.user_political_consents;
CREATE POLICY user_political_consents_select_own
  ON public.user_political_consents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.user_political_consents FROM anon;
GRANT SELECT ON TABLE public.user_political_consents TO authenticated;

CREATE OR REPLACE FUNCTION public.user_has_political_consent(p_user_id uuid, p_purpose text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_political_consents c
    WHERE c.user_id = p_user_id
      AND c.purpose = p_purpose
      AND c.withdrawn_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_political_consent(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_political_consent(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.record_political_consent(
  p_user_id uuid,
  p_purpose text,
  p_consent_text_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_purpose IS NULL OR p_consent_text_version IS NULL THEN
    RAISE EXCEPTION 'Missing consent parameters';
  END IF;

  INSERT INTO public.user_political_consents (user_id, purpose, consent_text_version, consented_at, withdrawn_at)
  VALUES (p_user_id, p_purpose, p_consent_text_version, now(), NULL)
  ON CONFLICT (user_id, purpose) DO UPDATE SET
    consent_text_version = EXCLUDED.consent_text_version,
    consented_at = EXCLUDED.consented_at,
    withdrawn_at = NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.record_political_consent(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_political_consent(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.withdraw_political_consent(p_user_id uuid, p_purpose text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_political_consents
  SET withdrawn_at = now()
  WHERE user_id = p_user_id
    AND purpose = p_purpose
    AND withdrawn_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_political_consent(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_political_consent(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.purge_political_processing_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.issue_stances WHERE user_id = p_user_id;
  DELETE FROM public.user_vote_receipts WHERE user_id = p_user_id;
  DELETE FROM public.poll_vote_receipts WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_political_processing_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_political_processing_data(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.withdraw_all_political_consents(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_political_consents
  SET withdrawn_at = now()
  WHERE user_id = p_user_id
    AND withdrawn_at IS NULL;

  PERFORM public.purge_political_processing_data(p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_all_political_consents(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_all_political_consents(uuid) TO service_role;
