-- TRANSACTIONAL (BEGIN/COMMIT). Apply after 20261026110300 (see EMBEDDING_V2_QUEUE_APPLY.md step 5).
-- Fixes prod statement_timeout on n8n_claim_chunks_missing_v2: tier was computed per pending row (~380k).
-- Computes fm_embedding_v2_issue_tier logic once per distinct issue_id; claims in priority order without global sort.
--
-- Coolify verify (rolled-back transaction):
--   BEGIN;
--   SET LOCAL ROLE service_role;
--   EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM n8n_claim_chunks_missing_v2('background', 2, 'diag', 60);
--   ROLLBACK;

BEGIN;

-- ---------------------------------------------------------------------------
-- Batch tier helper (mirrors fm_embedding_v2_issue_tier; current_sesjon evaluated once)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fm_embedding_v2_issue_tiers(p_issue_ids text[])
RETURNS TABLE (
  issue_id text,
  tier int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH ids AS (
    SELECT DISTINCT i AS id
    FROM unnest(coalesce(p_issue_ids, ARRAY[]::text[])) AS i
    WHERE i IS NOT NULL
  ),
  issue AS (
    SELECT
      ids.id,
      i.ferdigbehandlet,
      i.last_synced_at,
      i.last_updated_at,
      i.detail_json
    FROM ids
    LEFT JOIN public.stortinget_issues i ON i.id = ids.id
  ),
  has_pending AS (
    SELECT
      c.issue_id,
      true AS v
    FROM public.document_chunks c
    INNER JOIN ids ON ids.id = c.issue_id
    WHERE c.embedding_v2 IS NULL
      AND c.embedding_v2_status = 'pending'
      AND coalesce(btrim(c.content), '') <> ''
    GROUP BY c.issue_id
  ),
  current_sesjon AS (
    SELECT s.sesjon
    FROM (
      SELECT coalesce(
        nullif(trim(i.detail_json->>'sak_sesjon'), ''),
        nullif(trim(i.detail_json->>'sesjon_id'), '')
      ) AS sesjon
      FROM public.stortinget_issues i
      WHERE i.last_synced_at > now() - interval '180 days'
    ) s
    WHERE s.sesjon IS NOT NULL
    GROUP BY s.sesjon
    ORDER BY count(*) DESC
    LIMIT 1
  ),
  flags AS (
    SELECT
      iss.id,
      coalesce(hp.v, false) AS has_pending,
      iss.ferdigbehandlet,
      greatest(
        coalesce(iss.last_synced_at, '-infinity'::timestamptz),
        coalesce(iss.last_updated_at, '-infinity'::timestamptz)
      ) AS activity_at,
      coalesce(
        nullif(trim(iss.detail_json->>'sak_sesjon'), ''),
        nullif(trim(iss.detail_json->>'sesjon_id'), '')
      ) AS issue_sesjon,
      (iss.id LIKE '%--referatsaker%' OR iss.id LIKE '%referatsak%') AS referat_issue,
      EXISTS (
        SELECT 1
        FROM public.polls p
        WHERE p.stortinget_issue_id = iss.id
          AND p.track = 'system'
          AND p.status = 'open'
      ) AS open_poll,
      EXISTS (
        SELECT 1
        FROM public.stortinget_hearings h
        WHERE iss.id = ANY (h.related_issue_ids)
          AND (
            h.innspillsfrist IS NOT NULL AND h.innspillsfrist >= now()
            OR h.start_dato IS NOT NULL AND h.start_dato >= now() - interval '7 days'
          )
      ) AS open_hearing
    FROM issue iss
    LEFT JOIN has_pending hp ON hp.issue_id = iss.id
  )
  SELECT
    f.id AS issue_id,
    CASE
      WHEN NOT f.has_pending THEN NULL::int
      WHEN (
        coalesce(f.ferdigbehandlet, false) IS NOT TRUE
        AND f.activity_at > now() - interval '14 days'
      ) OR f.open_poll OR f.open_hearing THEN 0
      WHEN f.issue_sesjon IS NOT NULL
        AND f.issue_sesjon = (SELECT cs.sesjon FROM current_sesjon cs)
        AND NOT f.referat_issue THEN 1
      WHEN NOT f.referat_issue THEN 2
      ELSE 3
    END AS tier
  FROM flags f;
$$;

-- ---------------------------------------------------------------------------
-- n8n_claim_chunks_missing_v2 — issue-scoped tier + bounded priority walk
-- ---------------------------------------------------------------------------
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
DECLARE
  v_lane text := lower(nullif(btrim(p_lane), ''));
  v_worker text := nullif(btrim(p_worker), '');
  v_lease int := greatest(30, least(coalesce(p_lease_s, 300), 3600));
  v_lim int := greatest(1, least(coalesce(p_limit, 32), 256));
  v_need int;
  v_tier_sort int;
  v_doc_rank int;
  v_issue text;
  v_doc_ranks int[] := ARRAY[0, 1, 5, 9];
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

  INSERT INTO _fm_v2_claim_issue_tiers (issue_id, tier, sort_tier)
  WITH pending_issues AS MATERIALIZED (
    SELECT DISTINCT c.issue_id AS id
    FROM public.document_chunks c
    WHERE c.issue_id IS NOT NULL
      AND c.embedding_v2 IS NULL
      AND c.embedding_v2_status = 'pending'
      AND c.embedding_v2_attempts < 3
      AND coalesce(btrim(c.content), '') <> ''
      AND (
        c.embedding_v2_claimed_at IS NULL
        OR c.embedding_v2_claimed_at < now() - make_interval(secs => v_lease)
      )
  ),
  scored AS MATERIALIZED (
    SELECT
      t.issue_id,
      t.tier,
      CASE WHEN v_lane = 'background' THEN coalesce(t.tier, 99) ELSE 0 END AS sort_tier
    FROM public.fm_embedding_v2_issue_tiers(
      (SELECT coalesce(array_agg(pi.id ORDER BY pi.id), ARRAY[]::text[]) FROM pending_issues pi)
    ) t
    INNER JOIN pending_issues pi ON pi.id = t.issue_id
    WHERE (
      v_lane = 'fast'
      AND t.tier = 0
    ) OR (
      v_lane = 'background'
      AND coalesce(t.tier, 99) <> 0
    )
  )
  SELECT s.issue_id, s.tier, s.sort_tier
  FROM scored s;

  v_need := v_lim;

  FOR v_tier_sort IN
    SELECT DISTINCT sit.sort_tier
    FROM _fm_v2_claim_issue_tiers sit
    ORDER BY 1
  LOOP
    FOREACH v_doc_rank IN ARRAY v_doc_ranks LOOP
      FOR v_issue IN
        SELECT sit.issue_id
        FROM _fm_v2_claim_issue_tiers sit
        WHERE sit.sort_tier = v_tier_sort
        ORDER BY sit.issue_id
      LOOP
        INSERT INTO _fm_v2_claim_picked (id)
        SELECT picked.id
        FROM (
          SELECT c.id
          FROM public.document_chunks c
          LEFT JOIN public.stortinget_issue_documents d
            ON d.issue_id = c.issue_id AND d.document_id = c.document_id
          WHERE c.issue_id = v_issue
            AND c.embedding_v2 IS NULL
            AND c.embedding_v2_status = 'pending'
            AND c.embedding_v2_attempts < 3
            AND coalesce(btrim(c.content), '') <> ''
            AND (
              c.embedding_v2_claimed_at IS NULL
              OR c.embedding_v2_claimed_at < now() - make_interval(secs => v_lease)
            )
            AND (
              CASE
                WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%innstilling%' THEN 0
                WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%hoveddokument%' THEN 1
                WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%referat%' THEN 9
                ELSE 5
              END
            ) = v_doc_rank
            AND NOT EXISTS (
              SELECT 1 FROM _fm_v2_claim_picked p WHERE p.id = c.id
            )
          ORDER BY c.chunk_index ASC, c.id ASC
          LIMIT v_need
          FOR UPDATE OF c SKIP LOCKED
        ) picked;

        v_need := v_lim - (SELECT count(*)::int FROM _fm_v2_claim_picked);
        IF v_need <= 0 THEN
          EXIT;
        END IF;
      END LOOP;

      IF v_need <= 0 THEN
        EXIT;
      END IF;
    END LOOP;

    IF v_need <= 0 THEN
      EXIT;
    END IF;
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

REVOKE ALL ON FUNCTION public.fm_embedding_v2_issue_tiers(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_claim_chunks_missing_v2(text, int, text, int) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fm_embedding_v2_issue_tiers(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_claim_chunks_missing_v2(text, int, text, int) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
