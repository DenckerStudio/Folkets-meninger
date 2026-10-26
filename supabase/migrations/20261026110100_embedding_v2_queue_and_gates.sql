-- v2 embedding queue RPCs, health, DB pressure probe, and P6/P7 gates.
-- Tier predicates (documented):
--   Tier 0: issue has pending v2 chunks AND (
--     (coalesce(ferdigbehandlet, false) IS NOT TRUE AND greatest(last_synced_at, updated_at) > now() - 14 days)
--     OR open system poll (track=system, status=open) on stortinget_issue_id
--     OR open hearing (innspillsfrist >= now() OR start_dato >= now() - 7 days) linked via related_issue_ids
--   )
--   Tier 1: pending v2, not tier 0, issue session = current session (max sak_sesjon/sesjon_id among recently synced)
--   Tier 2: pending v2, not tier 0–1, not referat issue id pattern
--   Tier 3: pending v2 referat (*--referatsaker* or document referat) or low-value chunks only
-- Parallel workers: hash-shard on issue_id (abs(hashtext(issue_id)) % N = k). No row-claim writes.
-- Model columns: embedding_v2_model is canonical for bge-m3 (save_embeddings_v2). embedding_model is legacy nomic metadata only.

BEGIN;

-- ---------------------------------------------------------------------------
-- Shared predicate: chunk counts as embedded for pipelines / body cleanup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fm_chunk_has_usable_embedding(
  p_embedding_v2 public.vector,
  p_embedding_v2_status text,
  p_embedding public.vector,
  p_embedding_status text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT p_embedding_v2 IS NOT NULL
    OR (p_embedding IS NOT NULL AND p_embedding_status = 'ready');
$$;

-- ---------------------------------------------------------------------------
-- Issue tier for v2 backfill (0–3, NULL = no pending v2 on issue)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fm_embedding_v2_issue_tier(p_issue_id text)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH issue AS (
    SELECT
      i.id,
      i.ferdigbehandlet,
      i.last_synced_at,
      i.last_updated_at,
      i.detail_json
    FROM public.stortinget_issues i
    WHERE i.id = p_issue_id
  ),
  has_pending AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.document_chunks c
      WHERE c.issue_id = p_issue_id
        AND c.embedding_v2 IS NULL
        AND c.embedding_v2_status = 'pending'
        AND coalesce(btrim(c.content), '') <> ''
    ) AS v
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
      i.id,
      i.ferdigbehandlet,
      greatest(
        coalesce(i.last_synced_at, '-infinity'::timestamptz),
        coalesce(i.last_updated_at, '-infinity'::timestamptz)
      ) AS activity_at,
      coalesce(
        nullif(trim(i.detail_json->>'sak_sesjon'), ''),
        nullif(trim(i.detail_json->>'sesjon_id'), '')
      ) AS issue_sesjon,
      (i.id LIKE '%--referatsaker%' OR i.id LIKE '%referatsak%') AS referat_issue,
      EXISTS (
        SELECT 1
        FROM public.polls p
        WHERE p.stortinget_issue_id = i.id
          AND p.track = 'system'
          AND p.status = 'open'
      ) AS open_poll,
      EXISTS (
        SELECT 1
        FROM public.stortinget_hearings h
        WHERE p_issue_id = ANY (h.related_issue_ids)
          AND (
            h.innspillsfrist IS NOT NULL AND h.innspillsfrist >= now()
            OR h.start_dato IS NOT NULL AND h.start_dato >= now() - interval '7 days'
          )
      ) AS open_hearing
    FROM issue i
  )
  SELECT CASE
    WHEN NOT (SELECT v FROM has_pending) THEN NULL
    WHEN (
      coalesce(f.ferdigbehandlet, false) IS NOT TRUE
      AND f.activity_at > now() - interval '14 days'
    ) OR f.open_poll OR f.open_hearing THEN 0
    WHEN f.issue_sesjon IS NOT NULL
      AND f.issue_sesjon = (SELECT sesjon FROM current_sesjon)
      AND NOT f.referat_issue THEN 1
    WHEN NOT f.referat_issue THEN 2
    ELSE 3
  END
  FROM flags f;
$$;

-- ---------------------------------------------------------------------------
-- n8n_list_v2_priority_issues
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.n8n_list_v2_priority_issues(int, int);
DROP FUNCTION IF EXISTS public.n8n_list_v2_priority_issues(int, int, int, int);

CREATE OR REPLACE FUNCTION public.n8n_list_v2_priority_issues(
  p_tier int,
  p_limit int DEFAULT 50,
  p_worker_index int DEFAULT 0,
  p_worker_count int DEFAULT 1
)
RETURNS TABLE (
  issue_id text,
  pending_chunks int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH limits AS (
    SELECT
      greatest(1, least(coalesce(p_limit, 50), 500)) AS lim,
      greatest(1, coalesce(p_worker_count, 1)) AS wcount,
      greatest(0, least(coalesce(p_worker_index, 0), greatest(1, coalesce(p_worker_count, 1)) - 1)) AS windex
  ),
  issues AS (
    SELECT DISTINCT c.issue_id
    FROM public.document_chunks c
    WHERE c.issue_id IS NOT NULL
      AND c.embedding_v2 IS NULL
      AND c.embedding_v2_status = 'pending'
      AND coalesce(btrim(c.content), '') <> ''
  ),
  scored AS (
    SELECT
      i.issue_id,
      public.fm_embedding_v2_issue_tier(i.issue_id) AS tier,
      count(*)::int AS pending_chunks
    FROM issues i
    JOIN public.document_chunks c ON c.issue_id = i.issue_id
      AND c.embedding_v2 IS NULL
      AND c.embedding_v2_status = 'pending'
      AND coalesce(btrim(c.content), '') <> ''
    CROSS JOIN limits l
    WHERE public.fm_embedding_v2_issue_tier(i.issue_id) = p_tier
      AND (
        l.wcount <= 1
        OR abs(hashtext(i.issue_id)) % l.wcount = l.windex
      )
    GROUP BY i.issue_id
  )
  SELECT s.issue_id, s.pending_chunks
  FROM scored s
  CROSS JOIN limits l
  ORDER BY s.pending_chunks DESC, s.issue_id ASC
  LIMIT (SELECT lim FROM limits);
$$;

-- ---------------------------------------------------------------------------
-- n8n_list_chunks_missing_v2_for_issue (deterministic order; tier-1 doc priority)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.n8n_list_chunks_missing_v2_for_issue(text, int);

CREATE OR REPLACE FUNCTION public.n8n_list_chunks_missing_v2_for_issue(
  p_issue_id text,
  p_limit int DEFAULT 32
)
RETURNS TABLE (
  id uuid,
  content text,
  chunk_index int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    c.id,
    c.content,
    c.chunk_index
  FROM public.document_chunks c
  LEFT JOIN public.stortinget_issue_documents d
    ON d.issue_id = c.issue_id AND d.document_id = c.document_id
  WHERE c.issue_id = nullif(btrim(p_issue_id), '')
    AND c.embedding_v2 IS NULL
    AND c.embedding_v2_status = 'pending'
    AND c.embedding_v2_attempts < 3
    AND coalesce(btrim(c.content), '') <> ''
  ORDER BY
    CASE
      WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%innstilling%' THEN 0
      WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%hoveddokument%' THEN 1
      WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%referat%' THEN 9
      ELSE 5
    END,
    c.chunk_index ASC,
    c.id ASC
  LIMIT greatest(1, least(coalesce(p_limit, 32), 256));
$$;

-- ---------------------------------------------------------------------------
-- n8n_embedding_backlog_health (index-friendly predicates)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.n8n_embedding_backlog_health();

CREATE OR REPLACE FUNCTION public.n8n_embedding_backlog_health()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH pending_v2 AS (
    SELECT c.issue_id, c.created_at
    FROM public.document_chunks c
    WHERE c.embedding_v2 IS NULL
      AND c.embedding_v2_status = 'pending'
  ),
  tier0_issues AS (
    SELECT DISTINCT p.issue_id
    FROM pending_v2 p
    WHERE p.issue_id IS NOT NULL
      AND public.fm_embedding_v2_issue_tier(p.issue_id) = 0
  ),
  tier0_pending AS (
    SELECT p.*
    FROM pending_v2 p
    JOIN tier0_issues t ON t.issue_id = p.issue_id
  ),
  active_incomplete AS (
    SELECT t.issue_id
    FROM tier0_issues t
    WHERE EXISTS (
      SELECT 1
      FROM pending_v2 p
      WHERE p.issue_id = t.issue_id
    )
  )
  SELECT jsonb_build_object(
    'pending_v2_total', (SELECT count(*)::int FROM pending_v2),
    'pending_legacy_total', (
      SELECT count(*)::int
      FROM public.document_chunks c
      WHERE c.embedding_status = 'pending'
    ),
    'pending_v2_active', (SELECT count(*)::int FROM tier0_pending),
    'oldest_pending_active_age_s', coalesce(
      (
        SELECT greatest(0, floor(extract(epoch FROM (now() - min(p.created_at)))))::int
        FROM tier0_pending p
      ),
      0
    ),
    'active_issues_pending', (SELECT count(*)::int FROM active_incomplete),
    'failed_v2', (
      SELECT count(*)::int
      FROM public.document_chunks c
      WHERE c.embedding_v2_status = 'failed'
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Read-only backfill pressure (WAL + replication slot lag)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.n8n_backfill_db_pressure();

CREATE OR REPLACE FUNCTION public.n8n_backfill_db_pressure(
  p_slot_name text DEFAULT 'cainophile_vlftkp89',
  p_max_slot_lag_bytes bigint DEFAULT 4294967296,
  p_max_wal_bytes bigint DEFAULT 1073741824
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slot_lag bigint;
  v_wal_bytes bigint;
BEGIN
  SELECT coalesce(
    pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn),
    0
  )
  INTO v_slot_lag
  FROM pg_replication_slots
  WHERE slot_name = nullif(btrim(p_slot_name), '')
  LIMIT 1;

  IF v_slot_lag IS NULL THEN
    v_slot_lag := 0;
  END IF;

  SELECT coalesce(
    (SELECT sum(size) FROM pg_ls_waldir()),
    0
  )
  INTO v_wal_bytes;

  RETURN jsonb_build_object(
    'slot_name', nullif(btrim(p_slot_name), ''),
    'slot_lag_bytes', v_slot_lag,
    'wal_bytes', v_wal_bytes,
    'pause_recommended', v_slot_lag > p_max_slot_lag_bytes OR v_wal_bytes > p_max_wal_bytes
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- P7: legacy save rejects null embedding (never overwrite with null)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.n8n_save_document_embedding(uuid, vector);
DROP FUNCTION IF EXISTS public.n8n_save_document_embedding(uuid, text);

CREATE OR REPLACE FUNCTION public.n8n_save_document_embedding(
  p_chunk_id uuid,
  p_embedding text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_chunk_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_chunk_id');
  END IF;

  IF p_embedding IS NULL OR btrim(p_embedding) = '' OR lower(btrim(p_embedding)) = 'null' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'null_embedding', 'id', p_chunk_id);
  END IF;

  UPDATE public.document_chunks
  SET
    embedding = p_embedding::vector,
    embedding_status = 'ready'
  WHERE id = p_chunk_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'chunk_not_found', 'id', p_chunk_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_chunk_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- P6: finalize document storage — v2 OR legacy ready
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_finalize_document_storage(
  p_issue_id text,
  p_document_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.stortinget_issue_documents d
  SET
    chunks_status = CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.document_chunks c
        WHERE c.issue_id = d.issue_id
          AND c.document_id = d.document_id
          AND c.embedding_v2 IS NULL
          AND c.embedding_v2_status = 'pending'
      ) OR EXISTS (
        SELECT 1
        FROM public.document_chunks c
        WHERE c.issue_id = d.issue_id
          AND c.document_id = d.document_id
          AND c.embedding_status = 'pending'
      ) THEN 'pending'
      WHEN EXISTS (
        SELECT 1
        FROM public.document_chunks c
        WHERE c.issue_id = d.issue_id
          AND c.document_id = d.document_id
          AND public.fm_chunk_has_usable_embedding(
            c.embedding_v2, c.embedding_v2_status, c.embedding, c.embedding_status
          )
      ) THEN 'ready'
      ELSE d.chunks_status
    END,
    content_full_text = NULL,
    content_html = NULL
  WHERE d.issue_id = p_issue_id
    AND d.document_id = p_document_id;

  RETURN jsonb_build_object(
    'ok', true,
    'issue_id', p_issue_id,
    'document_id', p_document_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reclaim_document_body_storage()
RETURNS TABLE (
  cleared_html bigint,
  cleared_full_text bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  html_count bigint;
  text_count bigint;
BEGIN
  UPDATE public.stortinget_issue_documents
  SET content_html = NULL
  WHERE content_html IS NOT NULL;
  GET DIAGNOSTICS html_count = ROW_COUNT;

  UPDATE public.stortinget_issue_documents d
  SET content_full_text = NULL
  WHERE d.content_full_text IS NOT NULL
    AND (
      d.chunks_status = 'ready'
      OR EXISTS (
        SELECT 1
        FROM public.document_chunks c
        WHERE c.issue_id = d.issue_id
          AND c.document_id = d.document_id
          AND public.fm_chunk_has_usable_embedding(
            c.embedding_v2, c.embedding_v2_status, c.embedding, c.embedding_status
          )
      )
    );
  GET DIAGNOSTICS text_count = ROW_COUNT;

  RETURN QUERY SELECT html_count, text_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- P6: thin-summary branch in n8n_list_issues_missing_ai_summary
-- ---------------------------------------------------------------------------
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
  WITH candidates AS (
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
          AND public.fm_chunk_has_usable_embedding(
            dc.embedding_v2, dc.embedding_v2_status, dc.embedding, dc.embedding_status
          )
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
  claim_issue AS (
    UPDATE public.stortinget_issues i
    SET
      ai_summary_generation_attempts = i.ai_summary_generation_attempts + 1,
      ai_summary_last_attempt_at = now()
    FROM candidates c
    WHERE i.id = c.issue_id
      AND c.tier IN (0, 2)
      AND coalesce(i.ai_summary_generation_attempts, 0) < 5
      AND (
        i.ai_summary_last_attempt_at IS NULL
        OR i.ai_summary_last_attempt_at < now() - interval '15 minutes'
      )
    RETURNING i.id
  ),
  claim_regen AS (
    UPDATE public.issue_ai_summaries s
    SET
      regeneration_attempts = coalesce(s.regeneration_attempts, 0) + 1,
      regeneration_last_attempt_at = now()
    FROM candidates c
    WHERE s.stortinget_issue_id = c.issue_id
      AND c.tier = 1
      AND s.regeneration_requested_at IS NOT NULL
      AND coalesce(s.regeneration_attempts, 0) < 5
      AND (
        s.regeneration_last_attempt_at IS NULL
        OR s.regeneration_last_attempt_at < now() - interval '15 minutes'
      )
    RETURNING s.stortinget_issue_id AS id
  ),
  claimed AS (
    SELECT claim_issue.id AS issue_id FROM claim_issue
    UNION ALL
    SELECT claim_regen.id AS issue_id FROM claim_regen
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
  FROM claimed cl
  JOIN LATERAL public.n8n_get_issue_ai_summary_context(cl.issue_id) ctx ON true;
END;
$$;

-- P6: pipeline health thin_summaries gate
CREATE OR REPLACE FUNCTION public.n8n_pipeline_health()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH queue AS (
    SELECT
      i.id AS issue_id,
      CASE
        WHEN s.stortinget_issue_id IS NULL THEN 0
        WHEN s.regeneration_requested_at IS NOT NULL THEN 1
        ELSE 2
      END AS tier,
      s.regeneration_requested_at,
      i.last_synced_at
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
          AND public.fm_chunk_has_usable_embedding(
            dc.embedding_v2, dc.embedding_v2_status, dc.embedding, dc.embedding_status
          )
      )
      AND coalesce(i.ai_summary_generation_attempts, 0) < 5
      AND (
        i.ai_summary_last_attempt_at IS NULL
        OR i.ai_summary_last_attempt_at < now() - interval '15 minutes'
      )
    )
  ),
  ordered AS (
    SELECT issue_id
    FROM queue
    ORDER BY
      tier,
      regeneration_requested_at ASC NULLS LAST,
      last_synced_at DESC NULLS LAST
  )
  SELECT jsonb_build_object(
    'pending_chunks', (
      SELECT count(*)::int
      FROM public.document_chunks
      WHERE embedding_status = 'pending'
    ),
    'missing_summaries', (
      SELECT count(*)::int
      FROM public.stortinget_issues i
      LEFT JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id
      WHERE s.stortinget_issue_id IS NULL
    ),
    'thin_summaries', (
      SELECT count(*)::int
      FROM public.issue_ai_summaries s
      WHERE length(trim(coalesce(s.hva, ''))) < 180
        AND EXISTS (
          SELECT 1
          FROM public.document_chunks dc
          WHERE dc.issue_id = s.stortinget_issue_id
            AND public.fm_chunk_has_usable_embedding(
              dc.embedding_v2, dc.embedding_v2_status, dc.embedding, dc.embedding_status
            )
        )
    ),
    'draft_polls', (
      SELECT count(*)::int
      FROM public.polls
      WHERE track = 'system'
        AND status = 'draft'
    ),
    'recent_ops_events', (
      SELECT count(*)::int
      FROM public.n8n_ops_events
      WHERE created_at > now() - interval '24 hours'
    ),
    'summary_queue_depth', (SELECT count(*)::int FROM queue),
    'first_summary_queue_issue_id', (SELECT issue_id FROM ordered LIMIT 1)
  );
$$;

REVOKE ALL ON FUNCTION public.fm_chunk_has_usable_embedding(public.vector, text, public.vector, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fm_embedding_v2_issue_tier(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_list_v2_priority_issues(int, int, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_list_chunks_missing_v2_for_issue(text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_embedding_backlog_health() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_backfill_db_pressure(text, bigint, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_save_document_embedding(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_finalize_document_storage(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reclaim_document_body_storage() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_list_issues_missing_ai_summary(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_pipeline_health() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fm_chunk_has_usable_embedding(public.vector, text, public.vector, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fm_embedding_v2_issue_tier(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_list_v2_priority_issues(int, int, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_list_chunks_missing_v2_for_issue(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_embedding_backlog_health() TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_backfill_db_pressure(text, bigint, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_save_document_embedding(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_finalize_document_storage(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reclaim_document_body_storage() TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_list_issues_missing_ai_summary(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_pipeline_health() TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
