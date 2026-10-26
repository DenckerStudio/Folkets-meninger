-- RAG improvement round 2: prefix FTS last-token :*, pg_trgm lexical fallback.
BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- GIN (pg_trgm): 20261022109300 / 20261022109400 (CONCURRENTLY)

DROP FUNCTION IF EXISTS public.search_chunks_hybrid(
  text,
  vector,
  text[],
  text[],
  text,
  text,
  boolean,
  timestamptz,
  text,
  int
);

CREATE OR REPLACE FUNCTION public.search_chunks_hybrid(
  query_text text,
  query_embedding vector(1024) DEFAULT NULL,
  filter_issue_ids text[] DEFAULT NULL,
  filter_document_kinds text[] DEFAULT NULL,
  filter_sesjon text DEFAULT NULL,
  filter_komite text DEFAULT NULL,
  filter_ferdigbehandlet boolean DEFAULT NULL,
  filter_published_after timestamptz DEFAULT NULL,
  filter_hearing_id text DEFAULT NULL,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  issue_id text,
  hearing_id text,
  hearing_document_id uuid,
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
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  WITH params AS (
    SELECT
      nullif(btrim(coalesce(query_text, '')), '') AS qtext,
      CASE
        WHEN nullif(btrim(coalesce(query_text, '')), '') IS NULL THEN NULL::tsquery
        ELSE websearch_to_tsquery('norwegian', nullif(btrim(coalesce(query_text, '')), ''))
      END AS tsq,
      CASE
        WHEN nullif(btrim(coalesce(query_text, '')), '') IS NULL THEN NULL::tsquery
        ELSE (
          SELECT CASE WHEN lt IS NULL OR char_length(lt) < 2 THEN NULL::tsquery
            ELSE to_tsquery('norwegian', lt || ':*') END
          FROM (SELECT (regexp_match(nullif(btrim(coalesce(query_text, '')), ''), '([[:alnum:]]+)$'))[1] AS lt) x
        )
      END AS tsq_prefix,
      nullif(btrim(coalesce(query_text, '')), '') AS qtext_full,
      GREATEST(coalesce(match_count, 8), 1) AS k,
      query_embedding AS qemb,
      filter_issue_ids AS issue_ids,
      filter_document_kinds AS doc_kinds,
      nullif(btrim(coalesce(filter_sesjon, '')), '') AS sesjon,
      nullif(btrim(coalesce(filter_komite, '')), '') AS komite,
      filter_ferdigbehandlet AS ferdig,
      filter_published_after AS published_after,
      nullif(btrim(coalesce(filter_hearing_id, '')), '') AS hearing_id
  ),
  base AS (
    SELECT
      dc.id,
      dc.issue_id,
      dc.hearing_id,
      dc.hearing_document_id,
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
    WHERE p.hearing_id IS NULL
      AND dc.hearing_document_id IS NULL
      AND (p.issue_ids IS NULL OR dc.issue_id = ANY (p.issue_ids))
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
    UNION ALL
    SELECT
      dc.id,
      dc.issue_id,
      dc.hearing_id,
      dc.hearing_document_id,
      dc.document_id,
      dc.chunk_index,
      dc.content,
      dc.tsv,
      dc.embedding_v2,
      coalesce(hd.title, dc.metadata->>'document_title') AS document_title,
      coalesce(hd.kind, dc.metadata->>'document_kind') AS document_kind,
      hd.source_url,
      NULL::boolean AS ferdigbehandlet,
      NULL::timestamptz AS first_seen_at,
      NULL::text AS issue_sesjon,
      NULL::text AS issue_komite
    FROM public.document_chunks dc
    JOIN public.hearing_documents hd ON hd.id = dc.hearing_document_id
    CROSS JOIN params p
    WHERE p.hearing_id IS NOT NULL
      AND dc.hearing_id = p.hearing_id
      AND (
        p.doc_kinds IS NULL
        OR coalesce(hd.kind, dc.metadata->>'document_kind') = ANY (p.doc_kinds)
      )
  ),
  lexical AS (
    SELECT
      b.id,
      b.issue_id,
      b.hearing_id,
      b.hearing_document_id,
      b.document_id,
      b.chunk_index,
      b.content,
      b.document_title,
      b.document_kind,
      b.source_url,
      greatest(
        coalesce(ts_rank_cd(b.tsv, p.tsq), 0),
        coalesce(ts_rank_cd(b.tsv, p.tsq_prefix), 0),
        greatest(extensions.similarity(b.content, p.qtext_full), extensions.word_similarity(p.qtext_full, b.content))::real * 0.5
      )::real AS score_lexical,
      row_number() OVER (
        ORDER BY greatest(
          coalesce(ts_rank_cd(b.tsv, p.tsq), 0),
          coalesce(ts_rank_cd(b.tsv, p.tsq_prefix), 0),
          greatest(extensions.similarity(b.content, p.qtext_full), extensions.word_similarity(p.qtext_full, b.content))::real * 0.5
        ) DESC, b.chunk_index ASC
      )::int AS lex_rank
    FROM base b
    CROSS JOIN params p
    WHERE p.qtext_full IS NOT NULL
      AND (
        (p.tsq IS NOT NULL AND b.tsv @@ p.tsq)
        OR (p.tsq_prefix IS NOT NULL AND b.tsv @@ p.tsq_prefix)
        OR greatest(extensions.similarity(b.content, p.qtext_full), extensions.word_similarity(p.qtext_full, b.content)) > 0.32
      )
    ORDER BY score_lexical DESC, b.chunk_index ASC
    LIMIT 30
  ),
  semantic AS (
    SELECT
      b.id,
      b.issue_id,
      b.hearing_id,
      b.hearing_document_id,
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
      coalesce(l.hearing_id, s.hearing_id) AS hearing_id,
      coalesce(l.hearing_document_id, s.hearing_document_id) AS hearing_document_id,
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
      b.hearing_id,
      b.hearing_document_id,
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
    f.hearing_id,
    f.hearing_document_id,
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
  text,
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
  text,
  int
) TO authenticated, service_role;


COMMIT;
