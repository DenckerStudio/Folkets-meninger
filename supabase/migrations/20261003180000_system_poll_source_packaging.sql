-- Richer system-poll (Reels) source packaging without selecting full detail_json
-- in app list/sync queries. n8n may extract named fields for one pending sak.

DROP FUNCTION IF EXISTS public.n8n_list_sak_for_system_poll(text);
DROP FUNCTION IF EXISTS public.get_sak_poll_candidates(int);
DROP FUNCTION IF EXISTS public.get_sak_poll_coverage();

CREATE OR REPLACE FUNCTION public.n8n_list_sak_for_system_poll(p_issue_id text DEFAULT NULL)
RETURNS TABLE (
  issue_id text,
  issue_title text,
  issue_summary text,
  issue_category text,
  henvisning text,
  sak_kind text,
  komite text,
  first_seen_at timestamptz,
  last_updated_at timestamptz,
  detail_excerpt text,
  ai_hva text,
  ai_hvem text,
  ai_kostnad text,
  ai_narrative text,
  documents json,
  fallback_chunks json,
  existing_questions json,
  source_kind text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT i.id
    FROM public.stortinget_issues i
    WHERE i.status = 'pending'
      AND NOT EXISTS (
        SELECT 1
        FROM public.polls p
        WHERE p.stortinget_issue_id = i.id
          AND p.status IN ('draft', 'open', 'closed')
      )
      AND (
        EXISTS (
          SELECT 1
          FROM public.document_chunks dc
          WHERE dc.issue_id = i.id
            AND dc.embedding_status = 'ready'
            AND dc.embedding IS NOT NULL
        )
        OR EXISTS (
          SELECT 1
          FROM public.issue_ai_summaries s
          WHERE s.stortinget_issue_id = i.id
            AND length(trim(coalesce(s.hva, ''))) >= 40
        )
        OR EXISTS (
          SELECT 1
          FROM public.document_chunks dc
          WHERE dc.issue_id = i.id
            AND nullif(trim(dc.content), '') IS NOT NULL
        )
        OR length(trim(coalesce(i.summary, ''))) >= 80
      )
      AND (
        NULLIF(trim(coalesce(p_issue_id, '')), '') IS NULL
        OR i.id = NULLIF(trim(p_issue_id), '')
      )
    ORDER BY i.last_updated_at DESC NULLS LAST, i.first_seen_at ASC
    LIMIT 1
  )
  SELECT
    i.id AS issue_id,
    i.title AS issue_title,
    COALESCE(i.summary, '') AS issue_summary,
    COALESCE(i.category, '') AS issue_category,
    COALESCE(i.henvisning, '') AS henvisning,
    COALESCE(i.sak_kind, '') AS sak_kind,
    COALESCE(nullif(trim(i.detail_json->'komite'->>'navn'), ''), '') AS komite,
    i.first_seen_at,
    i.last_updated_at,
    left(
      COALESCE(
        nullif(trim(i.detail_json->>'innstillingstekst'), ''),
        nullif(trim(i.detail_json->>'vedtakstekst'), ''),
        i.summary,
        ''
      ),
      2400
    ) AS detail_excerpt,
    s.hva AS ai_hva,
    s.hvem AS ai_hvem,
    s.kostnad AS ai_kostnad,
    s.narrative AS ai_narrative,
    (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'document_id', d.document_id,
            'title', d.title,
            'document_type', d.document_type,
            'source_url', d.source_url,
            'text_excerpt', left(coalesce(d.text_excerpt, ''), 800)
          )
          ORDER BY d.fetched_at DESC
        ),
        '[]'::json
      )
      FROM (
        SELECT document_id, title, document_type, source_url, text_excerpt, fetched_at
        FROM public.stortinget_issue_documents
        WHERE issue_id = i.id
        ORDER BY fetched_at DESC
        LIMIT 6
      ) d
    ) AS documents,
    (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'document_id', c.document_id,
            'chunk_index', c.chunk_index,
            'content', left(c.content, 1400)
          )
          ORDER BY c.document_id, c.chunk_index
        ),
        '[]'::json
      )
      FROM (
        SELECT document_id, chunk_index, content
        FROM public.document_chunks
        WHERE issue_id = i.id
          AND nullif(trim(content), '') IS NOT NULL
        ORDER BY document_id, chunk_index
        LIMIT 8
      ) c
    ) AS fallback_chunks,
    (
      SELECT COALESCE(
        json_agg(DISTINCT lower(trim(title))) FILTER (
          WHERE title IS NOT NULL AND trim(title) <> ''
        ),
        '[]'::json
      )
      FROM public.polls
      WHERE trim(title) <> '' AND status IN ('open', 'draft', 'closed')
    ) AS existing_questions,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.document_chunks dc
        WHERE dc.issue_id = i.id
          AND dc.embedding_status = 'ready'
          AND dc.embedding IS NOT NULL
      ) THEN 'rag'
      WHEN length(trim(coalesce(s.hva, ''))) >= 40 THEN 'ai_summary'
      ELSE 'metadata'
    END AS source_kind
  FROM target t
  JOIN public.stortinget_issues i ON i.id = t.id
  LEFT JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id;
$$;

CREATE OR REPLACE FUNCTION public.get_sak_poll_coverage()
RETURNS TABLE (
  pending_issues bigint,
  pending_with_rag bigint,
  pending_with_poll bigint,
  sak_candidates bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE i.status = 'pending') AS pending_issues,
    COUNT(*) FILTER (
      WHERE i.status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM public.document_chunks dc
          WHERE dc.issue_id = i.id
            AND dc.embedding_status = 'ready'
        )
    ) AS pending_with_rag,
    COUNT(*) FILTER (
      WHERE i.status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM public.polls p
          WHERE p.stortinget_issue_id = i.id
            AND p.status IN ('draft', 'open', 'closed')
        )
    ) AS pending_with_poll,
    COUNT(*) FILTER (
      WHERE i.status = 'pending'
        AND NOT EXISTS (
          SELECT 1
          FROM public.polls p
          WHERE p.stortinget_issue_id = i.id
            AND p.status IN ('draft', 'open', 'closed')
        )
        AND (
          EXISTS (
            SELECT 1
            FROM public.document_chunks dc
            WHERE dc.issue_id = i.id
              AND dc.embedding_status = 'ready'
          )
          OR EXISTS (
            SELECT 1
            FROM public.issue_ai_summaries s
            WHERE s.stortinget_issue_id = i.id
              AND length(trim(coalesce(s.hva, ''))) >= 40
          )
          OR length(trim(coalesce(i.summary, ''))) >= 80
        )
    ) AS sak_candidates
  FROM public.stortinget_issues i;
$$;

CREATE OR REPLACE FUNCTION public.get_sak_poll_candidates(p_limit int DEFAULT 25)
RETURNS TABLE (
  issue_id text,
  title text,
  summary text,
  last_updated_at timestamptz,
  rag_chunk_count bigint,
  has_ai_summary boolean,
  source_kind text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id AS issue_id,
    i.title,
    i.summary,
    i.last_updated_at,
    (
      SELECT count(*)::bigint
      FROM public.document_chunks dc
      WHERE dc.issue_id = i.id
        AND dc.embedding_status = 'ready'
    ) AS rag_chunk_count,
    EXISTS (
      SELECT 1
      FROM public.issue_ai_summaries s
      WHERE s.stortinget_issue_id = i.id
        AND length(trim(coalesce(s.hva, ''))) >= 40
    ) AS has_ai_summary,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.document_chunks dc
        WHERE dc.issue_id = i.id
          AND dc.embedding_status = 'ready'
          AND dc.embedding IS NOT NULL
      ) THEN 'rag'
      WHEN EXISTS (
        SELECT 1
        FROM public.issue_ai_summaries s
        WHERE s.stortinget_issue_id = i.id
          AND length(trim(coalesce(s.hva, ''))) >= 40
      ) THEN 'ai_summary'
      ELSE 'metadata'
    END AS source_kind
  FROM public.stortinget_issues i
  WHERE i.status = 'pending'
    AND NOT EXISTS (
      SELECT 1
      FROM public.polls p
      WHERE p.stortinget_issue_id = i.id
        AND p.status IN ('draft', 'open', 'closed')
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.document_chunks dc
        WHERE dc.issue_id = i.id
          AND dc.embedding_status = 'ready'
          AND dc.embedding IS NOT NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.issue_ai_summaries s
        WHERE s.stortinget_issue_id = i.id
          AND length(trim(coalesce(s.hva, ''))) >= 40
      )
      OR length(trim(coalesce(i.summary, ''))) >= 80
    )
  ORDER BY i.last_updated_at DESC NULLS LAST, i.first_seen_at ASC
  LIMIT greatest(1, least(coalesce(p_limit, 25), 50));
$$;

REVOKE ALL ON FUNCTION public.n8n_list_sak_for_system_poll(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_sak_poll_coverage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_sak_poll_candidates(int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.n8n_list_sak_for_system_poll(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_sak_poll_coverage() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_sak_poll_candidates(int) TO service_role;

NOTIFY pgrst, 'reload schema';
