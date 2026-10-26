-- TRANSACTIONAL (BEGIN/COMMIT). Apply order: see EMBEDDING_V2_QUEUE_APPLY.md (step 2 of 4).
-- Faster n8n_embedding_backlog_health: estimated totals at scale, exact tier-0 via partial index.

BEGIN;

CREATE OR REPLACE FUNCTION public.fm_estimate_pending_chunk_count(
  p_legacy boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cap constant int := 10001;
  v_exact int;
  v_estimate int;
  v_live bigint;
BEGIN
  IF p_legacy THEN
    SELECT count(*)::int
    INTO v_exact
    FROM (
      SELECT 1
      FROM public.document_chunks c
      WHERE c.embedding_status = 'pending'
      LIMIT v_cap
    ) s;
  ELSE
    SELECT count(*)::int
    INTO v_exact
    FROM (
      SELECT 1
      FROM public.document_chunks c
      WHERE c.embedding_v2 IS NULL
        AND c.embedding_v2_status = 'pending'
      LIMIT v_cap
    ) s;
  END IF;

  IF v_exact < v_cap THEN
    RETURN jsonb_build_object('value', v_exact, 'is_estimate', false);
  END IF;

  SELECT c.reltuples::bigint
  INTO v_live
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'document_chunks';

  v_estimate := greatest(v_exact, coalesce(v_live, v_exact)::int);
  RETURN jsonb_build_object('value', v_estimate, 'is_estimate', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_embedding_backlog_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pending_v2 jsonb;
  v_pending_legacy jsonb;
  v_tier0_pending int := 0;
  v_oldest_age int := 0;
  v_active_issues int := 0;
  v_failed int;
BEGIN
  v_pending_v2 := public.fm_estimate_pending_chunk_count(false);
  v_pending_legacy := public.fm_estimate_pending_chunk_count(true);

  WITH tier0_candidates AS (
    SELECT i.id AS issue_id
    FROM public.stortinget_issues i
    WHERE (
      coalesce(i.ferdigbehandlet, false) IS NOT TRUE
      AND greatest(
        coalesce(i.last_synced_at, '-infinity'::timestamptz),
        coalesce(i.last_updated_at, '-infinity'::timestamptz)
      ) > now() - interval '14 days'
    )
    OR EXISTS (
      SELECT 1
      FROM public.polls p
      WHERE p.stortinget_issue_id = i.id
        AND p.track = 'system'
        AND p.status = 'open'
    )
    OR EXISTS (
      SELECT 1
      FROM public.stortinget_hearings h
      WHERE i.id = ANY (h.related_issue_ids)
        AND (
          h.innspillsfrist IS NOT NULL AND h.innspillsfrist >= now()
          OR h.start_dato IS NOT NULL AND h.start_dato >= now() - interval '7 days'
        )
    )
  ),
  tier0_chunks AS (
    SELECT c.issue_id, c.created_at
    FROM tier0_candidates t
    INNER JOIN public.document_chunks c ON c.issue_id = t.issue_id
      AND c.embedding_v2 IS NULL
      AND c.embedding_v2_status = 'pending'
  )
  SELECT
    count(*)::int,
    coalesce(
      greatest(0, floor(extract(epoch FROM (now() - min(tc.created_at)))))::int,
      0
    ),
    count(DISTINCT tc.issue_id)::int
  INTO v_tier0_pending, v_oldest_age, v_active_issues
  FROM tier0_chunks tc;

  SELECT count(*)::int
  INTO v_failed
  FROM public.document_chunks c
  WHERE c.embedding_v2_status = 'failed';

  RETURN jsonb_build_object(
    'pending_v2_total', (v_pending_v2->>'value')::int,
    'pending_v2_total_is_estimate', coalesce((v_pending_v2->>'is_estimate')::boolean, false),
    'pending_legacy_total', (v_pending_legacy->>'value')::int,
    'pending_legacy_total_is_estimate', coalesce((v_pending_legacy->>'is_estimate')::boolean, false),
    'pending_v2_active', coalesce(v_tier0_pending, 0),
    'oldest_pending_active_age_s', coalesce(v_oldest_age, 0),
    'active_issues_pending', coalesce(v_active_issues, 0),
    'failed_v2', coalesce(v_failed, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fm_estimate_pending_chunk_count(boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_embedding_backlog_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fm_estimate_pending_chunk_count(boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_embedding_backlog_health() TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
