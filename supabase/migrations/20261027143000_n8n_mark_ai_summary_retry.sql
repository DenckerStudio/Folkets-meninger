-- n8n GP666: nullstill fm-web webhook-claim (ai_summary_requested_at) slik at cron/n8n-retry kan sende på nytt.
-- Valgfri p_force setter regenereringskø (regeneration_requested_at fra 20261021140000).

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.n8n_mark_ai_summary_retry(
  p_issue_id text,
  p_force boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_issue_updated boolean := false;
BEGIN
  UPDATE public.stortinget_issues
  SET ai_summary_requested_at = NULL
  WHERE id = p_issue_id;

  v_issue_updated := FOUND;

  IF p_force THEN
    UPDATE public.issue_ai_summaries
    SET
      regeneration_requested_at = now(),
      regeneration_attempts = 0,
      regeneration_last_attempt_at = NULL
    WHERE stortinget_issue_id = p_issue_id;
  END IF;

  RETURN v_issue_updated;
END;
$$;

COMMENT ON FUNCTION public.n8n_mark_ai_summary_retry(text, boolean) IS
  'n8n (service_role): nullstill ai_summary_requested_at for fm-web n8n-retry. p_force=true setter regeneration_requested_at for regenereringskø.';

REVOKE ALL ON FUNCTION public.n8n_mark_ai_summary_retry(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_mark_ai_summary_retry(text, boolean) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
