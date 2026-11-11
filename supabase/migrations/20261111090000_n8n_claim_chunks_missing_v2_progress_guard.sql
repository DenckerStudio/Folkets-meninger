-- TRANSACTIONAL (BEGIN/COMMIT). Apply after 20261110120100.
-- Set-based pick per sort_tier (replaces per-issue × doc_rank loop from 120100).
--
-- Coolify verify (after apply):
--   SET ROLE authenticator;
--   SET statement_timeout = '8s';
--   EXPLAIN (ANALYZE, BUFFERS)
--     SELECT * FROM n8n_claim_chunks_missing_v2('background', 16, 'diag', 60);

BEGIN;

CREATE OR REPLACE FUNCTION public.n8n_claim_chunks_missing_v2(
  p_lane text,
  p_limit int,
  p_worker text,
  p_lease_s int DEFAULT 300
)
RETURNS TABLE (
  id uuid,
  content text,
  chunk_index int,
  issue_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_lane text := lower(nullif(btrim(p_lane), ''));
  v_worker text := nullif(btrim(p_worker), '');
  v_lease int := greatest(30, least(coalesce(p_lease_s, 300), 3600));
  v_lim int := greatest(1, least(coalesce(p_limit, 32), 256));
  v_need int;
  v_tier_sort int;
BEGIN
  IF v_worker IS NULL THEN
    RAISE EXCEPTION 'p_worker required';
  END IF;
  IF v_lane IS NULL OR v_lane NOT IN ('fast', 'background') THEN
    RAISE EXCEPTION 'p_lane must be fast or background';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _fm_v2_claim_picked (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _fm_v2_claim_picked;

  CREATE TEMP TABLE IF NOT EXISTS _fm_v2_claim_issue_tiers (
    issue_id text PRIMARY KEY,
    tier int,
    sort_tier int NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE _fm_v2_claim_issue_tiers;

  CREATE TEMP TABLE IF NOT EXISTS _fm_v2_claim_pending_issues (
    issue_id text PRIMARY KEY
  ) ON COMMIT DROP;
  TRUNCATE _fm_v2_claim_pending_issues;

  INSERT INTO _fm_v2_claim_pending_issues (issue_id)
  SELECT DISTINCT c.issue_id
  FROM public.document_chunks c
  WHERE c.issue_id IS NOT NULL
    AND c.embedding_v2 IS NULL
    AND c.embedding_v2_status = 'pending'
    AND c.embedding_v2_attempts < 3
    AND (
      c.embedding_v2_claimed_at IS NULL
      OR c.embedding_v2_claimed_at < now() - make_interval(secs => v_lease)
    );

  INSERT INTO _fm_v2_claim_issue_tiers (issue_id, tier, sort_tier)
  SELECT
    t.issue_id,
    t.tier,
    CASE WHEN v_lane = 'background' THEN coalesce(t.tier, 99) ELSE 0 END AS sort_tier
  FROM public.fm_embedding_v2_issue_tiers(
    (SELECT coalesce(array_agg(pi.issue_id ORDER BY pi.issue_id), ARRAY[]::text[])
     FROM _fm_v2_claim_pending_issues pi)
  ) t
  INNER JOIN _fm_v2_claim_pending_issues pi ON pi.issue_id = t.issue_id
  WHERE (
    v_lane = 'fast'
    AND t.tier = 0
  ) OR (
    v_lane = 'background'
    AND coalesce(t.tier, 99) <> 0
  );

  v_need := v_lim;

  FOR v_tier_sort IN
    SELECT DISTINCT sit.sort_tier
    FROM _fm_v2_claim_issue_tiers sit
    ORDER BY 1
  LOOP
    IF v_need <= 0 THEN
      EXIT;
    END IF;

    INSERT INTO _fm_v2_claim_picked (id)
    SELECT picked.id
    FROM (
      SELECT c.id
      FROM _fm_v2_claim_issue_tiers sit
      INNER JOIN public.document_chunks c ON c.issue_id = sit.issue_id
      LEFT JOIN public.stortinget_issue_documents d
        ON d.issue_id = c.issue_id AND d.document_id = c.document_id
      WHERE sit.sort_tier = v_tier_sort
        AND c.embedding_v2 IS NULL
        AND c.embedding_v2_status = 'pending'
        AND c.embedding_v2_attempts < 3
        AND coalesce(btrim(c.content), '') <> ''
        AND (
          c.embedding_v2_claimed_at IS NULL
          OR c.embedding_v2_claimed_at < now() - make_interval(secs => v_lease)
        )
        AND NOT EXISTS (
          SELECT 1 FROM _fm_v2_claim_picked p WHERE p.id = c.id
        )
      ORDER BY
        (
          CASE
            WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%innstilling%' THEN 0
            WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%hoveddokument%' THEN 1
            WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%referat%' THEN 9
            ELSE 5
          END
        ) ASC,
        sit.issue_id ASC,
        c.chunk_index ASC,
        c.id ASC
      LIMIT v_need
      FOR UPDATE OF c SKIP LOCKED
    ) picked;

    v_need := v_lim - (SELECT count(*)::int FROM _fm_v2_claim_picked);
  END LOOP;

  RETURN QUERY
  WITH claimed AS (
    UPDATE public.document_chunks c
    SET
      embedding_v2_claimed_at = now(),
      embedding_v2_claimed_by = v_worker
    FROM _fm_v2_claim_picked p
    WHERE c.id = p.id
    RETURNING c.id, c.content, c.chunk_index, c.issue_id
  ),
  ranked AS (
    SELECT
      cl.id,
      cl.content,
      cl.chunk_index,
      cl.issue_id,
      sit.sort_tier,
      CASE
        WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%innstilling%' THEN 0
        WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%hoveddokument%' THEN 1
        WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%referat%' THEN 9
        ELSE 5
      END AS doc_rank
    FROM claimed cl
    INNER JOIN public.document_chunks c ON c.id = cl.id
    LEFT JOIN public.stortinget_issue_documents d
      ON d.issue_id = c.issue_id AND d.document_id = c.document_id
    LEFT JOIN _fm_v2_claim_issue_tiers sit ON sit.issue_id = cl.issue_id
  )
  SELECT r.id, r.content, r.chunk_index, r.issue_id
  FROM ranked r
  ORDER BY
    r.sort_tier ASC,
    r.doc_rank ASC,
    r.issue_id ASC,
    r.chunk_index ASC,
    r.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_claim_chunks_missing_v2(text, int, text, int) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.n8n_claim_chunks_missing_v2(text, int, text, int) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
