-- Norwegian full-text search (plan P4, uke 1).
--
-- Until now FTS only existed inline in two service_role RPCs, with the
-- 'simple' config (no stemming, so «barnehager» did not match «barnehage»).
-- This migration:
--   1. (Re)builds generated tsvector columns with the 'norwegian' config on
--      document_chunks.content and stortinget_issues (title/henvisning/summary),
--      plus GIN indexes.
--   2. Rewrites search_issue_document_chunks_text and
--      search_stortinget_issues_for_chat to use those columns,
--      websearch_to_tsquery('norwegian', …) and an OR fallback.
--   3. Adds search_document_chunks_fts: SECURITY INVOKER, readable by
--      anon/authenticated (same rows document_chunks already exposes), so the
--      chat can rank a whole sak instead of «the first 40 chunks».
-- Embedding columns are never returned.
--
-- Note: adding a STORED generated column rewrites the table. On a large
-- document_chunks table run this outside peak hours.

-- 1a. document_chunks.fts ---------------------------------------------------
DROP INDEX IF EXISTS public.document_chunks_fts_idx;
ALTER TABLE public.document_chunks DROP COLUMN IF EXISTS fts;
ALTER TABLE public.document_chunks
  ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (to_tsvector('norwegian'::regconfig, coalesce(content, ''))) STORED;
CREATE INDEX document_chunks_fts_idx ON public.document_chunks USING gin (fts);

COMMENT ON COLUMN public.document_chunks.fts IS
  'Generated tsvector (norwegian) over content, for chat/eval lexical search.';

-- 1b. stortinget_issues.fts -------------------------------------------------
DROP INDEX IF EXISTS public.stortinget_issues_fts_idx;
ALTER TABLE public.stortinget_issues DROP COLUMN IF EXISTS fts;
ALTER TABLE public.stortinget_issues
  ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('norwegian'::regconfig, coalesce(title, '')), 'A')
    || setweight(to_tsvector('norwegian'::regconfig, coalesce(henvisning, '')), 'A')
    || setweight(to_tsvector('norwegian'::regconfig, coalesce(summary, '')), 'B')
  ) STORED;
CREATE INDEX stortinget_issues_fts_idx ON public.stortinget_issues USING gin (fts);

COMMENT ON COLUMN public.stortinget_issues.fts IS
  'Generated tsvector (norwegian): title and henvisning weight A, summary weight B.';

-- 2. Query helpers -------------------------------------------------------------
-- websearch_to_tsquery ANDs every term; chat questions are full sentences, so
-- we also need an OR variant ("any term") for recall and rank on top of it.
CREATE OR REPLACE FUNCTION public.fts_query_all(p_query text)
RETURNS tsquery
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN nullif(btrim(coalesce(p_query, '')), '') IS NULL THEN NULL
    ELSE nullif(websearch_to_tsquery('norwegian'::regconfig, left(p_query, 400))::text, '')::tsquery
  END;
$$;

CREATE OR REPLACE FUNCTION public.fts_query_any(p_query text)
RETURNS tsquery
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  -- Exclusions («-ord» → !'ord') would turn into «OR NOT» and match almost
  -- everything, so queries with a negation keep the strict AND form.
  SELECT CASE
    WHEN position('!' IN public.fts_query_all(p_query)::text) > 0 THEN public.fts_query_all(p_query)
    ELSE nullif(replace(public.fts_query_all(p_query)::text, ' & ', ' | '), '')::tsquery
  END;
$$;

GRANT EXECUTE ON FUNCTION public.fts_query_all(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fts_query_any(text) TO anon, authenticated, service_role;

-- 3. Existing service_role RPCs, now norwegian + indexed -----------------------
CREATE OR REPLACE FUNCTION public.search_issue_document_chunks_text(
  p_issue_id text,
  p_query text,
  p_match_count int DEFAULT 8
)
RETURNS TABLE (
  document_id text,
  chunk_index int,
  content text,
  rank float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT
      nullif(btrim(coalesce(p_query, '')), '') AS query,
      public.fts_query_all(p_query) AS q_all,
      public.fts_query_any(p_query) AS q_any
  )
  SELECT
    dc.document_id,
    dc.chunk_index,
    dc.content,
    CASE
      WHEN q.query IS NULL OR q.q_any IS NULL THEN 0::float
      ELSE (
        ts_rank_cd(dc.fts, q.q_any)
        + CASE WHEN dc.fts @@ q.q_all THEN 1 ELSE 0 END
      )::float
    END AS rank
  FROM public.document_chunks dc
  CROSS JOIN q
  WHERE dc.issue_id = p_issue_id
    AND (
      q.query IS NULL
      OR (q.q_any IS NOT NULL AND dc.fts @@ q.q_any)
      OR dc.content ILIKE '%' || left(q.query, 80) || '%'
    )
  ORDER BY rank DESC, dc.chunk_index ASC
  LIMIT GREATEST(coalesce(p_match_count, 8), 1);
$$;

CREATE OR REPLACE FUNCTION public.search_stortinget_issues_for_chat(
  p_query text,
  p_limit int DEFAULT 6
)
RETURNS TABLE (
  id text,
  title text,
  summary text,
  henvisning text,
  ferdigbehandlet boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT
      nullif(btrim(coalesce(p_query, '')), '') AS query,
      public.fts_query_all(p_query) AS q_all,
      public.fts_query_any(p_query) AS q_any
  )
  SELECT
    i.id,
    i.title,
    left(coalesce(i.summary, ''), 400) AS summary,
    i.henvisning,
    i.ferdigbehandlet
  FROM public.stortinget_issues i
  CROSS JOIN q
  WHERE q.query IS NOT NULL
    AND (
      i.id = btrim(p_query)
      OR (q.q_any IS NOT NULL AND i.fts @@ q.q_any)
      OR i.title ILIKE '%' || left(q.query, 80) || '%'
      OR coalesce(i.summary, '') ILIKE '%' || left(q.query, 80) || '%'
    )
  ORDER BY
    CASE WHEN i.id = btrim(p_query) THEN 0 ELSE 1 END,
    CASE WHEN q.q_all IS NOT NULL AND i.fts @@ q.q_all THEN 0 ELSE 1 END,
    CASE WHEN q.q_any IS NULL THEN 0 ELSE ts_rank_cd(i.fts, q.q_any) END DESC,
    i.last_synced_at DESC NULLS LAST
  LIMIT GREATEST(coalesce(p_limit, 6), 1);
$$;

REVOKE ALL ON FUNCTION public.search_issue_document_chunks_text(text, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_stortinget_issues_for_chat(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_issue_document_chunks_text(text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_stortinget_issues_for_chat(text, int) TO service_role;

-- 4. Chat chunk search for the session client (SECURITY INVOKER) ---------------
CREATE OR REPLACE FUNCTION public.search_document_chunks_fts(
  p_issue_id text,
  p_query text,
  p_match_count int DEFAULT 8
)
RETURNS TABLE (
  issue_id text,
  document_id text,
  chunk_index int,
  content text,
  metadata jsonb,
  rank float
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT public.fts_query_all(p_query) AS q_all, public.fts_query_any(p_query) AS q_any
  )
  SELECT
    dc.issue_id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    dc.metadata,
    (
      ts_rank_cd(dc.fts, q.q_any)
      + CASE WHEN dc.fts @@ q.q_all THEN 1 ELSE 0 END
    )::float AS rank
  FROM public.document_chunks dc
  CROSS JOIN q
  WHERE dc.issue_id = p_issue_id
    AND q.q_any IS NOT NULL
    AND dc.fts @@ q.q_any
  ORDER BY rank DESC, dc.chunk_index ASC
  LIMIT LEAST(GREATEST(coalesce(p_match_count, 8), 1), 50);
$$;

COMMENT ON FUNCTION public.search_document_chunks_fts(text, text, int) IS
  'Norwegian FTS over one sak''s document_chunks (SECURITY INVOKER; RLS applies). Never returns vector columns.';

REVOKE ALL ON FUNCTION public.search_document_chunks_fts(text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_document_chunks_fts(text, text, int)
  TO anon, authenticated, service_role;
