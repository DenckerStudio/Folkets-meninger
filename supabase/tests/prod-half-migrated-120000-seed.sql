-- Simulates prod drift that breaks naive CREATE OR REPLACE in 20261020120000 (parameter defaults).
-- Apply after 20261020110001 + hotfix + n8n lockdowns, before 20261020120000.

CREATE OR REPLACE FUNCTION public.record_political_consent(
  p_user_id uuid,
  p_purpose text,
  p_consent_text_version text DEFAULT 'folkets-consent-v1'
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

REVOKE ALL ON FUNCTION public.record_political_consent(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_political_consent(uuid, text, text) TO service_role;
