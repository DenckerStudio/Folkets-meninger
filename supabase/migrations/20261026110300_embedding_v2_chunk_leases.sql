-- TRANSACTIONAL (BEGIN/COMMIT). Apply with phase-A session settings (see EMBEDDING_V2_QUEUE_APPLY.md).
-- Lease columns on document_chunks (~380k rows): nullable timestamptz + text, NO DEFAULT —
-- metadata-only ADD COLUMN in PostgreSQL (no heap rewrite). Expired leases are reclaimable without cron.

BEGIN;

ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS embedding_v2_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS embedding_v2_claimed_by text;

COMMENT ON COLUMN public.document_chunks.embedding_v2_claimed_at IS
  'Backfill lease start; NULL = unclaimed. Expired leases are reclaimable via n8n_claim_chunks_missing_v2.';
COMMENT ON COLUMN public.document_chunks.embedding_v2_claimed_by IS
  'Opaque worker id (endpoint name + instance). Cleared when embedding_v2 is saved.';

-- ---------------------------------------------------------------------------
-- n8n_claim_chunks_missing_v2
-- p_lane: fast (tier 0 only) | background (tier 1–3)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.n8n_claim_chunks_missing_v2(text, int, text, int);

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
BEGIN
  IF v_worker IS NULL THEN
    RAISE EXCEPTION 'p_worker required';
  END IF;
  IF v_lane IS NULL OR v_lane NOT IN ('fast', 'background') THEN
    RAISE EXCEPTION 'p_lane must be fast or background';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT c.id
    FROM public.document_chunks c
    LEFT JOIN public.stortinget_issue_documents d
      ON d.issue_id = c.issue_id AND d.document_id = c.document_id
    WHERE c.embedding_v2 IS NULL
      AND c.embedding_v2_status = 'pending'
      AND c.embedding_v2_attempts < 3
      AND coalesce(btrim(c.content), '') <> ''
      AND (
        c.embedding_v2_claimed_at IS NULL
        OR c.embedding_v2_claimed_at < now() - make_interval(secs => v_lease)
      )
      AND (
        (
          v_lane = 'fast'
          AND c.issue_id IS NOT NULL
          AND public.fm_embedding_v2_issue_tier(c.issue_id) = 0
        )
        OR (
          v_lane = 'background'
          AND c.issue_id IS NOT NULL
          AND coalesce(public.fm_embedding_v2_issue_tier(c.issue_id), 99) <> 0
        )
      )
    ORDER BY
      CASE v_lane
        WHEN 'background' THEN coalesce(public.fm_embedding_v2_issue_tier(c.issue_id), 99)
        ELSE 0
      END ASC,
      CASE
        WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%innstilling%' THEN 0
        WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%hoveddokument%' THEN 1
        WHEN coalesce(d.document_type, c.metadata->>'document_kind', '') ILIKE '%referat%' THEN 9
        ELSE 5
      END,
      c.issue_id ASC,
      c.chunk_index ASC,
      c.id ASC
    LIMIT v_lim
    FOR UPDATE OF c SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.document_chunks c
    SET
      embedding_v2_claimed_at = now(),
      embedding_v2_claimed_by = v_worker
    FROM candidates cand
    WHERE c.id = cand.id
    RETURNING c.id, c.content, c.chunk_index, c.issue_id
  )
  SELECT cl.id, cl.content, cl.chunk_index, cl.issue_id FROM claimed cl;
END;
$$;

-- ---------------------------------------------------------------------------
-- Release claims for a worker (clean shutdown)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.n8n_release_embedding_v2_claims(text);

CREATE OR REPLACE FUNCTION public.n8n_release_embedding_v2_claims(p_worker text)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH cleared AS (
    UPDATE public.document_chunks c
    SET
      embedding_v2_claimed_at = NULL,
      embedding_v2_claimed_by = NULL
    WHERE c.embedding_v2 IS NULL
      AND c.embedding_v2_claimed_by = nullif(btrim(p_worker), '')
    RETURNING 1
  )
  SELECT count(*)::int FROM cleared;
$$;

-- ---------------------------------------------------------------------------
-- save_embeddings_v2 — optional p_worker enforces active lease
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_embeddings_v2(jsonb, text, boolean);
DROP FUNCTION IF EXISTS public.save_embeddings_v2(jsonb, text, boolean, text);
DROP FUNCTION IF EXISTS public.save_embeddings_v2(jsonb, text, boolean, text, int);

CREATE OR REPLACE FUNCTION public.save_embeddings_v2(
  p_rows jsonb,
  p_model text,
  p_force boolean DEFAULT false,
  p_worker text DEFAULT NULL,
  p_lease_s int DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row jsonb;
  v_id uuid;
  v_emb vector(1024);
  v_dims int;
  v_saved int := 0;
  v_failed int := 0;
  v_skipped int := 0;
  v_worker text := nullif(btrim(coalesce(p_worker, '')), '');
  v_lease int := greatest(30, least(coalesce(p_lease_s, 300), 3600));
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('saved', 0, 'failed', 0, 'skipped', 0, 'error', 'rows_must_be_array');
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    BEGIN
      v_id := (v_row->>'id')::uuid;
    EXCEPTION
      WHEN OTHERS THEN
        v_failed := v_failed + 1;
        CONTINUE;
    END;

    IF v_id IS NULL THEN
      v_failed := v_failed + 1;
      CONTINUE;
    END IF;

    IF NOT p_force AND EXISTS (
      SELECT 1 FROM public.document_chunks c WHERE c.id = v_id AND c.embedding_v2 IS NOT NULL
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    BEGIN
      v_emb := (v_row->>'embedding')::vector(1024);
      v_dims := vector_dims(v_emb);
    EXCEPTION
      WHEN OTHERS THEN
        UPDATE public.document_chunks c
        SET
          embedding_v2_attempts = c.embedding_v2_attempts + 1,
          embedding_v2_status = CASE
            WHEN c.embedding_v2_attempts + 1 >= 3 THEN 'failed'
            ELSE 'pending'
          END,
          embedding_v2_claimed_at = NULL,
          embedding_v2_claimed_by = NULL
        WHERE c.id = v_id
          AND (v_worker IS NULL OR c.embedding_v2_claimed_by = v_worker);
        v_failed := v_failed + 1;
        CONTINUE;
    END;

    IF v_dims IS DISTINCT FROM 1024 THEN
      UPDATE public.document_chunks c
      SET
        embedding_v2_attempts = c.embedding_v2_attempts + 1,
        embedding_v2_status = CASE
          WHEN c.embedding_v2_attempts + 1 >= 3 THEN 'failed'
          ELSE 'pending'
        END,
        embedding_v2_claimed_at = NULL,
        embedding_v2_claimed_by = NULL
      WHERE c.id = v_id
        AND (v_worker IS NULL OR c.embedding_v2_claimed_by = v_worker);
      v_failed := v_failed + 1;
      CONTINUE;
    END IF;

    UPDATE public.document_chunks c
    SET
      embedding_v2 = v_emb,
      embedding_v2_model = nullif(btrim(coalesce(p_model, '')), ''),
      embedding_v2_at = now(),
      embedding_v2_status = 'ready',
      embedding_v2_claimed_at = NULL,
      embedding_v2_claimed_by = NULL
    WHERE c.id = v_id
      AND (p_force OR c.embedding_v2 IS NULL)
      AND (
        v_worker IS NULL
        OR (
          c.embedding_v2_claimed_by = v_worker
          AND c.embedding_v2_claimed_at IS NOT NULL
          AND c.embedding_v2_claimed_at >= now() - make_interval(secs => v_lease)
        )
      );

    IF FOUND THEN
      v_saved := v_saved + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('saved', v_saved, 'failed', v_failed, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_claim_chunks_missing_v2(text, int, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_release_embedding_v2_claims(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_embeddings_v2(jsonb, text, boolean, text, int) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.n8n_claim_chunks_missing_v2(text, int, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_release_embedding_v2_claims(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_embeddings_v2(jsonb, text, boolean, text, int) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
