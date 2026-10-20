-- Admin-avvist sammendrag + atomisk admin_submit_content_feedback.
-- Kø (GP666Zq84qc19tcE): manglende sammendrag først, deretter regenerering FIFO (regeneration_requested_at ASC).

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.issue_ai_summaries
  ADD COLUMN IF NOT EXISTS regeneration_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS regeneration_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS regeneration_last_attempt_at timestamptz;

COMMENT ON COLUMN public.issue_ai_summaries.regeneration_requested_at IS
  'Satt ved admin_submit_content_feedback reject (ai_summary); null ved approve eller nytt sammendrag fra n8n.';

COMMENT ON COLUMN public.issue_ai_summaries.regeneration_attempts IS
  'Antall n8n-forsøk på regenerering; nullstilles ved vellykket upsert eller ny admin-avvisning.';

COMMENT ON COLUMN public.issue_ai_summaries.regeneration_last_attempt_at IS
  'Sist n8n forsøkte regenerering; brukes til backoff (15 min) så én feilende sak ikke blokkerer køen.';

ALTER TABLE public.stortinget_issues
  ADD COLUMN IF NOT EXISTS ai_summary_generation_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_summary_last_attempt_at timestamptz;

COMMENT ON COLUMN public.stortinget_issues.ai_summary_generation_attempts IS
  'n8n-forsøk på første/tynt sammendrag; nullstilles ved vellykket upsert eller admin-reset.';

COMMENT ON COLUMN public.stortinget_issues.ai_summary_last_attempt_at IS
  'Sist n8n forsøkte generering uten full sak-rad; backoff 15 min.';

-- ---------------------------------------------------------------------------
-- n8n_list_issues_missing_ai_summary — claim + backoff (FOR UPDATE SKIP LOCKED)
-- Rekkefølge: (1) mangler rad, (2) regenerering FIFO, (3) tynt sammendrag.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.n8n_mark_issue_ai_summary_regeneration_attempt(text);
DROP FUNCTION IF EXISTS public.n8n_list_issues_missing_ai_summary(int);

CREATE OR REPLACE FUNCTION public.n8n_list_issues_missing_ai_summary(p_limit int DEFAULT 1)
RETURNS TABLE (
  id text,
  title text,
  summary text,
  henvisning text,
  last_synced_at timestamptz,
  detail_json jsonb,
  ai_summary_source_context text,
  documents json,
  document_chunks json
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit int := greatest(1, least(coalesce(p_limit, 1), 50));
BEGIN
  RETURN QUERY
  WITH eligible AS (
    SELECT
      i.id AS issue_id,
      CASE
        WHEN s.stortinget_issue_id IS NULL THEN 0
        WHEN s.regeneration_requested_at IS NOT NULL THEN 1
        ELSE 2
      END AS tier
    FROM public.stortinget_issues i
    LEFT JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id
    WHERE (
      s.stortinget_issue_id IS NULL
      AND coalesce(i.ai_summary_generation_attempts, 0) < 5
      AND (
        i.ai_summary_last_attempt_at IS NULL
        OR i.ai_summary_last_attempt_at < now() - interval '15 minutes'
      )
    )
    OR (
      s.regeneration_requested_at IS NOT NULL
      AND coalesce(s.regeneration_attempts, 0) < 5
      AND (
        s.regeneration_last_attempt_at IS NULL
        OR s.regeneration_last_attempt_at < now() - interval '15 minutes'
      )
    )
    OR (
      s.stortinget_issue_id IS NOT NULL
      AND s.regeneration_requested_at IS NULL
      AND length(trim(coalesce(s.hva, ''))) < 180
      AND s.updated_at < now() - interval '12 hours'
      AND EXISTS (
        SELECT 1
        FROM public.document_chunks dc
        WHERE dc.issue_id = i.id
          AND dc.embedding_status = 'ready'
      )
      AND coalesce(i.ai_summary_generation_attempts, 0) < 5
      AND (
        i.ai_summary_last_attempt_at IS NULL
        OR i.ai_summary_last_attempt_at < now() - interval '15 minutes'
      )
    )
    ORDER BY
      CASE
        WHEN s.stortinget_issue_id IS NULL THEN 0
        WHEN s.regeneration_requested_at IS NOT NULL THEN 1
        ELSE 2
      END,
      s.regeneration_requested_at ASC NULLS LAST,
      i.last_synced_at DESC NULLS LAST
    FOR UPDATE OF i SKIP LOCKED
    LIMIT v_limit
  ),
  bump_issue AS (
    UPDATE public.stortinget_issues i
    SET
      ai_summary_generation_attempts = i.ai_summary_generation_attempts + 1,
      ai_summary_last_attempt_at = now()
    FROM eligible e
    WHERE i.id = e.issue_id
      AND e.tier IN (0, 2)
    RETURNING i.id
  ),
  bump_regen AS (
    UPDATE public.issue_ai_summaries s
    SET
      regeneration_attempts = coalesce(s.regeneration_attempts, 0) + 1,
      regeneration_last_attempt_at = now()
    FROM eligible e
    WHERE s.stortinget_issue_id = e.issue_id
      AND e.tier = 1
    RETURNING s.stortinget_issue_id
  )
  SELECT
    ctx.id,
    ctx.title,
    ctx.summary,
    ctx.henvisning,
    ctx.last_synced_at,
    ctx.detail_json,
    ctx.ai_summary_source_context,
    ctx.documents,
    ctx.document_chunks
  FROM eligible e
  JOIN LATERAL public.n8n_get_issue_ai_summary_context(e.issue_id) ctx ON true;
END;
$$;

-- ---------------------------------------------------------------------------
-- n8n_upsert_issue_ai_summary — samme signatur/retur; nuller regenereringsflagg
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.n8n_upsert_issue_ai_summary(
  p_issue_id text,
  p_hva text,
  p_hvem text,
  p_kostnad text,
  p_narrative text DEFAULT NULL,
  p_who_affected text DEFAULT NULL,
  p_how_affected text DEFAULT NULL,
  p_topic_cards jsonb DEFAULT '[]'::jsonb,
  p_labels text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hva text := coalesce(nullif(trim(p_hva), ''), nullif(trim(p_narrative), ''), '');
  v_hvem text := coalesce(nullif(trim(p_hvem), ''), nullif(trim(p_who_affected), ''), '');
  v_kostnad text := coalesce(nullif(trim(p_kostnad), ''), '');
  v_narrative text := coalesce(nullif(trim(p_narrative), ''), v_hva);
  v_who text := coalesce(nullif(trim(p_who_affected), ''), v_hvem);
  v_how text := coalesce(nullif(trim(p_how_affected), ''), v_kostnad);
  v_labels text[] := coalesce(p_labels, '{}'::text[]);
BEGIN
  INSERT INTO public.issue_ai_summaries (
    stortinget_issue_id,
    hva,
    hvem,
    kostnad,
    narrative,
    who_affected,
    how_affected,
    topic_cards,
    labels,
    regeneration_requested_at,
    regeneration_attempts,
    regeneration_last_attempt_at,
    updated_at
  )
  VALUES (
    p_issue_id,
    v_hva,
    v_hvem,
    v_kostnad,
    v_narrative,
    v_who,
    v_how,
    coalesce(p_topic_cards, '[]'::jsonb),
    v_labels,
    NULL,
    0,
    NULL,
    now()
  )
  ON CONFLICT (stortinget_issue_id) DO UPDATE SET
    hva = EXCLUDED.hva,
    hvem = EXCLUDED.hvem,
    kostnad = EXCLUDED.kostnad,
    narrative = EXCLUDED.narrative,
    who_affected = EXCLUDED.who_affected,
    how_affected = EXCLUDED.how_affected,
    topic_cards = EXCLUDED.topic_cards,
    labels = EXCLUDED.labels,
    regeneration_requested_at = NULL,
    regeneration_attempts = 0,
    regeneration_last_attempt_at = NULL,
    updated_at = now();

  UPDATE public.stortinget_issues
  SET
    ai_labels = v_labels,
    ai_summary_generation_attempts = 0,
    ai_summary_last_attempt_at = NULL
  WHERE id = p_issue_id;

  RETURN jsonb_build_object('ok', true, 'stortinget_issue_id', p_issue_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_list_ai_summary_queue_gave_up / admin_reset_ai_summary_queue_attempts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_ai_summary_queue_gave_up(p_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'issue_id', row.issue_id,
        'title', row.title,
        'kind', row.kind,
        'attempts', row.attempts,
        'last_attempt_at', row.last_attempt_at
      )
      ORDER BY row.last_attempt_at DESC NULLS LAST
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT
      i.id AS issue_id,
      i.title,
      'mangler_sammendrag'::text AS kind,
      i.ai_summary_generation_attempts AS attempts,
      i.ai_summary_last_attempt_at AS last_attempt_at
    FROM public.stortinget_issues i
    LEFT JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id
    WHERE s.stortinget_issue_id IS NULL
      AND i.ai_summary_generation_attempts >= 5

    UNION ALL

    SELECT
      s.stortinget_issue_id,
      i.title,
      'regenerering'::text,
      s.regeneration_attempts,
      s.regeneration_last_attempt_at
    FROM public.issue_ai_summaries s
    JOIN public.stortinget_issues i ON i.id = s.stortinget_issue_id
    WHERE s.regeneration_requested_at IS NOT NULL
      AND s.regeneration_attempts >= 5

    UNION ALL

    SELECT
      i.id,
      i.title,
      'tynt_sammendrag'::text,
      i.ai_summary_generation_attempts,
      i.ai_summary_last_attempt_at
    FROM public.stortinget_issues i
    JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id
    WHERE s.regeneration_requested_at IS NULL
      AND length(trim(coalesce(s.hva, ''))) < 180
      AND i.ai_summary_generation_attempts >= 5
  ) row
  LIMIT greatest(1, least(coalesce(p_limit, 1), 200));
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_ai_summary_queue_attempts(p_issue_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.stortinget_issues
  SET
    ai_summary_generation_attempts = 0,
    ai_summary_last_attempt_at = NULL
  WHERE id = p_issue_id;

  UPDATE public.issue_ai_summaries
  SET
    regeneration_attempts = 0,
    regeneration_last_attempt_at = NULL
  WHERE stortinget_issue_id = p_issue_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_submit_content_feedback — én transaksjon (feedback + regenereringsflagg)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_submit_content_feedback(
  p_content_type text,
  p_content_id text,
  p_verdict text,
  p_aspects jsonb DEFAULT '{}'::jsonb,
  p_reason_tags text[] DEFAULT '{}',
  p_note text DEFAULT NULL,
  p_admin_id uuid DEFAULT NULL,
  p_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_feedback_id uuid;
BEGIN
  v_feedback_id := public.upsert_content_feedback(
    p_content_type,
    p_content_id,
    p_verdict,
    p_aspects,
    p_reason_tags,
    p_note,
    p_admin_id,
    p_snapshot
  );

  IF p_content_type = 'ai_summary' THEN
    IF p_verdict = 'reject' THEN
      UPDATE public.issue_ai_summaries
      SET
        regeneration_requested_at = now(),
        regeneration_attempts = 0,
        regeneration_last_attempt_at = NULL
      WHERE stortinget_issue_id = p_content_id;
    ELSIF p_verdict = 'approve' THEN
      UPDATE public.issue_ai_summaries
      SET
        regeneration_requested_at = NULL,
        regeneration_attempts = 0,
        regeneration_last_attempt_at = NULL
      WHERE stortinget_issue_id = p_content_id;
    END IF;
  END IF;

  RETURN v_feedback_id;
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_list_issues_missing_ai_summary(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_list_issues_missing_ai_summary(int) TO service_role;

REVOKE ALL ON FUNCTION public.n8n_upsert_issue_ai_summary(
  text, text, text, text, text, text, text, jsonb, text[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_upsert_issue_ai_summary(
  text, text, text, text, text, text, text, jsonb, text[]
) TO service_role;

REVOKE ALL ON FUNCTION public.admin_list_ai_summary_queue_gave_up(int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_ai_summary_queue_gave_up(int) TO service_role;

REVOKE ALL ON FUNCTION public.admin_reset_ai_summary_queue_attempts(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_ai_summary_queue_attempts(text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_submit_content_feedback(
  text, text, text, jsonb, text[], text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_submit_content_feedback(
  text, text, text, jsonb, text[], text, uuid, jsonb
) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
