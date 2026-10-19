-- P4 hybrid search (Norwegian FTS + optional embedding_v2 semantic) and P6 prep (bge-m3 column + HNSW).
-- Existing nomic embedding vector(768) is unchanged.

BEGIN;

-- -----------------------------------------------------------------------------
-- Full-text search columns (Norwegian)
-- -----------------------------------------------------------------------------

ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('norwegian', coalesce(content, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS document_chunks_tsv_gin_idx
  ON public.document_chunks USING gin (tsv);

ALTER TABLE public.stortinget_issues
  ADD COLUMN IF NOT EXISTS tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('norwegian', coalesce(title, '')), 'A')
    || setweight(to_tsvector('norwegian', coalesce(henvisning, '')), 'A')
    || setweight(to_tsvector('norwegian', coalesce(summary, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS stortinget_issues_tsv_gin_idx
  ON public.stortinget_issues USING gin (tsv);

-- -----------------------------------------------------------------------------
-- P6 prep: parallel embedding store (bge-m3 / 1024-dim)
-- -----------------------------------------------------------------------------

ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS embedding_v2 vector(1024),
  ADD COLUMN IF NOT EXISTS embedding_model text;

CREATE INDEX IF NOT EXISTS document_chunks_embedding_v2_hnsw_idx
  ON public.document_chunks
  USING hnsw (embedding_v2 vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding_v2 IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Issue search (FTS) — replaces ilike saksøk in chat
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_issues_fts(
  query_text text,
  match_count int DEFAULT 6
)
RETURNS TABLE (
  id text,
  title text,
  summary text,
  henvisning text,
  ferdigbehandlet boolean,
  rank real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT
      nullif(btrim(coalesce(query_text, '')), '') AS raw,
      CASE
        WHEN nullif(btrim(coalesce(query_text, '')), '') IS NULL THEN NULL::tsquery
        ELSE websearch_to_tsquery('norwegian', nullif(btrim(coalesce(query_text, '')), ''))
      END AS tsq
  )
  SELECT
    i.id,
    i.title,
    left(coalesce(i.summary, ''), 400) AS summary,
    i.henvisning,
    i.ferdigbehandlet,
    ts_rank_cd(i.tsv, q.tsq)::real AS rank
  FROM public.stortinget_issues i
  CROSS JOIN q
  WHERE q.raw IS NOT NULL
    AND (
      i.id = q.raw
      OR (q.tsq IS NOT NULL AND i.tsv @@ q.tsq)
    )
  ORDER BY
    CASE WHEN i.id = q.raw THEN 0 ELSE 1 END,
    rank DESC,
    i.last_synced_at DESC NULLS LAST
  LIMIT GREATEST(coalesce(match_count, 6), 1);
$$;

REVOKE ALL ON FUNCTION public.search_issues_fts(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_issues_fts(text, int) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Hybrid chunk search (lexical top 30 + semantic top 30, RRF k=60)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_chunks_hybrid(
  query_text text,
  query_embedding vector(1024) DEFAULT NULL,
  filter_issue_ids text[] DEFAULT NULL,
  filter_document_kinds text[] DEFAULT NULL,
  filter_sesjon text DEFAULT NULL,
  filter_komite text DEFAULT NULL,
  filter_ferdigbehandlet boolean DEFAULT NULL,
  filter_published_after timestamptz DEFAULT NULL,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  issue_id text,
  document_id text,
  document_title text,
  document_kind text,
  source_url text,
  chunk_index int,
  content text,
  score_lexical real,
  score_semantic real,
  score_fused real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      nullif(btrim(coalesce(query_text, '')), '') AS qtext,
      CASE
        WHEN nullif(btrim(coalesce(query_text, '')), '') IS NULL THEN NULL::tsquery
        ELSE websearch_to_tsquery('norwegian', nullif(btrim(coalesce(query_text, '')), ''))
      END AS tsq,
      GREATEST(coalesce(match_count, 8), 1) AS k,
      query_embedding AS qemb,
      filter_issue_ids AS issue_ids,
      filter_document_kinds AS doc_kinds,
      nullif(btrim(coalesce(filter_sesjon, '')), '') AS sesjon,
      nullif(btrim(coalesce(filter_komite, '')), '') AS komite,
      filter_ferdigbehandlet AS ferdig,
      filter_published_after AS published_after
  ),
  base AS (
    SELECT
      dc.id,
      dc.issue_id,
      dc.document_id,
      dc.chunk_index,
      dc.content,
      dc.tsv,
      dc.embedding_v2,
      coalesce(d.title, dc.metadata->>'document_title') AS document_title,
      coalesce(d.document_type, dc.metadata->>'document_kind') AS document_kind,
      d.source_url,
      i.ferdigbehandlet,
      i.first_seen_at,
      coalesce(
        nullif(trim(i.detail_json->>'sak_sesjon'), ''),
        nullif(trim(i.detail_json->>'sesjon_id'), '')
      ) AS issue_sesjon,
      nullif(trim(i.detail_json->'komite'->>'navn'), '') AS issue_komite
    FROM public.document_chunks dc
    JOIN public.stortinget_issues i ON i.id = dc.issue_id
    LEFT JOIN public.stortinget_issue_documents d
      ON d.issue_id = dc.issue_id AND d.document_id = dc.document_id
    CROSS JOIN params p
    WHERE (p.issue_ids IS NULL OR dc.issue_id = ANY (p.issue_ids))
      AND (
        p.doc_kinds IS NULL
        OR coalesce(d.document_type, dc.metadata->>'document_kind') = ANY (p.doc_kinds)
      )
      AND (p.sesjon IS NULL OR coalesce(
        nullif(trim(i.detail_json->>'sak_sesjon'), ''),
        nullif(trim(i.detail_json->>'sesjon_id'), '')
      ) = p.sesjon)
      AND (p.komite IS NULL OR nullif(trim(i.detail_json->'komite'->>'navn'), '') = p.komite)
      AND (p.ferdig IS NULL OR i.ferdigbehandlet IS NOT DISTINCT FROM p.ferdig)
      AND (p.published_after IS NULL OR i.first_seen_at >= p.published_after)
  ),
  lexical AS (
    SELECT
      b.id,
      b.issue_id,
      b.document_id,
      b.chunk_index,
      b.content,
      b.document_title,
      b.document_kind,
      b.source_url,
      ts_rank_cd(b.tsv, p.tsq)::real AS score_lexical,
      row_number() OVER (
        ORDER BY ts_rank_cd(b.tsv, p.tsq) DESC, b.chunk_index ASC
      )::int AS lex_rank
    FROM base b
    CROSS JOIN params p
    WHERE p.tsq IS NOT NULL
      AND b.tsv @@ p.tsq
    ORDER BY score_lexical DESC, b.chunk_index ASC
    LIMIT 30
  ),
  semantic AS (
    SELECT
      b.id,
      b.issue_id,
      b.document_id,
      b.chunk_index,
      b.content,
      b.document_title,
      b.document_kind,
      b.source_url,
      (1 - (b.embedding_v2 <=> p.qemb))::real AS score_semantic,
      row_number() OVER (
        ORDER BY b.embedding_v2 <=> p.qemb ASC
      )::int AS sem_rank
    FROM base b
    CROSS JOIN params p
    WHERE p.qemb IS NOT NULL
      AND b.embedding_v2 IS NOT NULL
    ORDER BY b.embedding_v2 <=> p.qemb ASC
    LIMIT 30
  ),
  fused AS (
    SELECT
      coalesce(l.id, s.id) AS id,
      coalesce(l.issue_id, s.issue_id) AS issue_id,
      coalesce(l.document_id, s.document_id) AS document_id,
      coalesce(l.chunk_index, s.chunk_index) AS chunk_index,
      coalesce(l.content, s.content) AS content,
      coalesce(l.document_title, s.document_title) AS document_title,
      coalesce(l.document_kind, s.document_kind) AS document_kind,
      coalesce(l.source_url, s.source_url) AS source_url,
      l.score_lexical,
      s.score_semantic,
      (
        coalesce(1.0 / (60.0 + l.lex_rank), 0.0)
        + coalesce(1.0 / (60.0 + s.sem_rank), 0.0)
      )::real AS score_fused
    FROM lexical l
    FULL OUTER JOIN semantic s ON s.id = l.id
  ),
  fallback AS (
    SELECT
      b.id,
      b.issue_id,
      b.document_id,
      b.chunk_index,
      b.content,
      b.document_title,
      b.document_kind,
      b.source_url,
      0::real AS score_lexical,
      NULL::real AS score_semantic,
      0::real AS score_fused
    FROM base b
    CROSS JOIN params p
    WHERE NOT EXISTS (SELECT 1 FROM fused)
      AND p.qtext IS NOT NULL
      AND b.content ILIKE '%' || left(p.qtext, 80) || '%'
    ORDER BY b.chunk_index ASC
    LIMIT (SELECT k FROM params)
  )
  SELECT
    f.id,
    f.issue_id,
    f.document_id,
    f.document_title,
    f.document_kind,
    f.source_url,
    f.chunk_index,
    f.content,
    f.score_lexical,
    f.score_semantic,
    f.score_fused
  FROM (
    SELECT * FROM fused
    UNION ALL
    SELECT * FROM fallback
  ) f
  ORDER BY f.score_fused DESC, f.chunk_index ASC
  LIMIT (SELECT k FROM params);
$$;

REVOKE ALL ON FUNCTION public.search_chunks_hybrid(
  text,
  vector,
  text[],
  text[],
  text,
  text,
  boolean,
  timestamptz,
  int
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_chunks_hybrid(
  text,
  vector,
  text[],
  text[],
  text,
  text,
  boolean,
  timestamptz,
  int
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
