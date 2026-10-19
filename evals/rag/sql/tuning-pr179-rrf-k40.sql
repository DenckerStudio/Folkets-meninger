-- Eval tuning only (#179): lower RRF k from 60 → 40 for denser fusion tail.
-- Apply to rag_eval_stack before improved run; production change belongs in 20261019200000 follow-up.

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
      filter_published_after AS published_after,
      nullif(btrim(coalesce(filter_hearing_id, '')), '') AS hearing_id,
      40.0::float AS rrf_k
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
    LEFT JOIN public.stortinget_issues i ON i.id = dc.issue_id
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
      AND (
        p.hearing_id IS NULL
        OR nullif(btrim(dc.metadata->>'hearing_id'), '') = p.hearing_id
      )
  ),
  lexical AS (
    SELECT b.*, ts_rank_cd(b.tsv, p.tsq)::real AS score_lexical,
      row_number() OVER (ORDER BY ts_rank_cd(b.tsv, p.tsq) DESC, b.chunk_index ASC)::int AS lex_rank
    FROM base b
    CROSS JOIN params p
    WHERE p.tsq IS NOT NULL AND b.tsv @@ p.tsq
    ORDER BY score_lexical DESC, b.chunk_index ASC
    LIMIT 30
  ),
  semantic AS (
    SELECT b.*, (1 - (b.embedding_v2 <=> p.qemb))::real AS score_semantic,
      row_number() OVER (ORDER BY b.embedding_v2 <=> p.qemb ASC)::int AS sem_rank
    FROM base b
    CROSS JOIN params p
    WHERE p.qemb IS NOT NULL AND b.embedding_v2 IS NOT NULL
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
        coalesce(1.0 / (p.rrf_k + l.lex_rank), 0.0)
        + coalesce(1.0 / (p.rrf_k + s.sem_rank), 0.0)
      )::real AS score_fused
    FROM lexical l
    FULL OUTER JOIN semantic s ON s.id = l.id
    CROSS JOIN params p
  ),
  fallback AS (
    SELECT b.id, b.issue_id, b.document_id, b.chunk_index, b.content,
      b.document_title, b.document_kind, b.source_url,
      0::real AS score_lexical, NULL::real AS score_semantic, 0::real AS score_fused
    FROM base b
    CROSS JOIN params p
    WHERE NOT EXISTS (SELECT 1 FROM fused)
      AND p.qtext IS NOT NULL
      AND b.content ILIKE '%' || left(p.qtext, 80) || '%'
    ORDER BY b.chunk_index ASC
    LIMIT (SELECT k FROM params)
  )
  SELECT f.id, f.issue_id, f.document_id, f.document_title, f.document_kind, f.source_url,
    f.chunk_index, f.content, f.score_lexical, f.score_semantic, f.score_fused
  FROM (SELECT * FROM fused UNION ALL SELECT * FROM fallback) f
  ORDER BY f.score_fused DESC, f.chunk_index ASC
  LIMIT (SELECT k FROM params);
$$;
