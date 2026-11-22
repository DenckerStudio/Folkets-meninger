-- Reddit reply_worth (fase 1): svarverdi-score for admin outreach-kø.
-- Manuell apply på prod (Coolify Expert). Aldri auto-push.
-- Function bodies use tagged dollar-quotes ($function$) like other reddit RPCs.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.reddit_signals
  ADD COLUMN IF NOT EXISTS reply_worth smallint,
  ADD COLUMN IF NOT EXISTS reply_worth_reason text,
  ADD COLUMN IF NOT EXISTS reply_worth_model text,
  ADD COLUMN IF NOT EXISTS reply_worth_scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_worth_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reply_gate_passes boolean;

ALTER TABLE public.reddit_signals
  DROP CONSTRAINT IF EXISTS reddit_signals_reply_worth_check;

ALTER TABLE public.reddit_signals
  ADD CONSTRAINT reddit_signals_reply_worth_check
    CHECK (reply_worth IS NULL OR (reply_worth >= 1 AND reply_worth <= 5));

ALTER TABLE public.reddit_signals
  DROP CONSTRAINT IF EXISTS reddit_signals_reply_worth_status_check;

ALTER TABLE public.reddit_signals
  ADD CONSTRAINT reddit_signals_reply_worth_status_check
    CHECK (
      reply_worth_status IN ('pending', 'scored', 'skipped', 'failed')
    );

CREATE INDEX IF NOT EXISTS reddit_signals_reply_worth_idx
  ON public.reddit_signals (reply_worth DESC NULLS LAST)
  WHERE reply_worth IS NOT NULL;

CREATE INDEX IF NOT EXISTS reddit_signals_reply_worth_pending_idx
  ON public.reddit_signals (posted_at DESC)
  WHERE reply_worth_status = 'pending' AND status = 'ny';

-- ---------------------------------------------------------------------------
-- n8n_list_reddit_reply_worth_candidates -- soft SQL prefilter; full gate i n8n
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_list_reddit_reply_worth_candidates(
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  reddit_id text,
  subreddit text,
  title text,
  score int,
  num_comments int,
  contention numeric,
  flair text,
  removal_type text,
  status text,
  posted_at timestamptz,
  related_issue_id text,
  related_issue_title text,
  reply_worth_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_limit int := greatest(1, least(coalesce(p_limit, 5), 25));
BEGIN
  RETURN QUERY
  SELECT
    rs.id,
    rs.reddit_id,
    rs.subreddit,
    rs.title,
    rs.score,
    rs.num_comments,
    rs.contention,
    rs.flair,
    rs.removal_type,
    rs.status,
    rs.posted_at,
    rs.related_issue_id,
    si.title_nb AS related_issue_title,
    rs.reply_worth_status
  FROM public.reddit_signals rs
  LEFT JOIN public.stortinget_issues si ON si.id = rs.related_issue_id
  WHERE rs.reply_worth_status = 'pending'
    AND rs.status = 'ny'
    AND rs.posted_at >= now() - interval '72 hours'
    AND rs.score >= 5
    AND rs.num_comments >= 3
    AND rs.num_comments <= 150
    AND rs.removal_type IS NULL
  ORDER BY rs.posted_at DESC
  LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.n8n_list_reddit_reply_worth_candidates(int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_list_reddit_reply_worth_candidates(int)
  TO service_role;

-- ---------------------------------------------------------------------------
-- n8n_set_reddit_reply_worth -- skriv score / skip / fail (service_role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_set_reddit_reply_worth(
  p_reddit_id text,
  p_status text,
  p_worth smallint DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_gate_passes boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_reddit_id text;
  v_status text;
  v_reason text;
  v_model text;
  v_row public.reddit_signals%ROWTYPE;
BEGIN
  v_reddit_id := nullif(btrim(coalesce(p_reddit_id, '')), '');
  IF v_reddit_id IS NULL OR v_reddit_id !~ '^[a-z0-9]{1,12}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reddit_id');
  END IF;

  v_status := nullif(btrim(coalesce(p_status, '')), '');
  IF v_status IS NULL OR v_status NOT IN ('scored', 'skipped', 'failed', 'pending') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  IF v_status = 'scored' THEN
    IF p_worth IS NULL OR p_worth < 1 OR p_worth > 5 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_worth');
    END IF;
  END IF;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN
    v_reason := left(v_reason, 500);
  END IF;

  v_model := nullif(btrim(coalesce(p_model, '')), '');
  IF v_model IS NOT NULL AND char_length(v_model) > 120 THEN
    v_model := left(v_model, 120);
  END IF;

  SELECT * INTO v_row
  FROM public.reddit_signals
  WHERE reddit_id = v_reddit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found', 'reddit_id', v_reddit_id);
  END IF;

  UPDATE public.reddit_signals
  SET
    reply_worth = CASE
      WHEN v_status = 'scored' THEN p_worth
      WHEN v_status = 'pending' THEN NULL
      ELSE reply_worth
    END,
    reply_worth_reason = CASE
      WHEN v_status IN ('scored', 'skipped', 'failed') THEN v_reason
      WHEN v_status = 'pending' THEN NULL
      ELSE reply_worth_reason
    END,
    reply_worth_model = CASE
      WHEN v_status = 'scored' THEN v_model
      WHEN v_status = 'pending' THEN NULL
      ELSE reply_worth_model
    END,
    reply_worth_scored_at = CASE
      WHEN v_status IN ('scored', 'skipped', 'failed') THEN now()
      WHEN v_status = 'pending' THEN NULL
      ELSE reply_worth_scored_at
    END,
    reply_worth_status = v_status,
    reply_gate_passes = CASE
      WHEN p_gate_passes IS NOT NULL THEN p_gate_passes
      WHEN v_status = 'skipped' THEN false
      WHEN v_status = 'scored' THEN coalesce(reply_gate_passes, true)
      WHEN v_status = 'pending' THEN NULL
      ELSE reply_gate_passes
    END
  WHERE reddit_id = v_reddit_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'reddit_id', v_row.reddit_id,
    'reply_worth', v_row.reply_worth,
    'reply_worth_status', v_row.reply_worth_status,
    'reply_gate_passes', v_row.reply_gate_passes
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.n8n_set_reddit_reply_worth(text, text, smallint, text, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_set_reddit_reply_worth(text, text, smallint, text, text, boolean)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
