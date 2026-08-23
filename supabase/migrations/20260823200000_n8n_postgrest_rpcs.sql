-- PostgREST-friendly n8n RPCs.
-- 20260823180000 likely aborted at n8n_list_issues_missing_ai_summary (42P13),
-- so upsert/embedding functions never landed. RETURNS void and vector args also
-- miss the PostgREST schema cache (PGRST202). Use jsonb + text embeddings.

DROP FUNCTION IF EXISTS public.n8n_upsert_issue_ai_summary(text, text, text, text);
DROP FUNCTION IF EXISTS public.n8n_save_document_embedding(uuid, vector);
DROP FUNCTION IF EXISTS public.n8n_save_document_embedding(uuid, text);
DROP FUNCTION IF EXISTS public.n8n_finalize_document_storage(text, text);
DROP FUNCTION IF EXISTS public.n8n_match_issue_document_chunks(text, text, int);
DROP FUNCTION IF EXISTS public.n8n_list_sak_for_system_poll(text);
DROP FUNCTION IF EXISTS public.n8n_list_pending_document_chunks(text, int);

CREATE OR REPLACE FUNCTION public.n8n_upsert_issue_ai_summary(
  p_issue_id text,
  p_hva text,
  p_hvem text,
  p_kostnad text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.issue_ai_summaries (
    stortinget_issue_id,
    hva,
    hvem,
    kostnad,
    updated_at
  )
  VALUES (
    p_issue_id,
    coalesce(p_hva, ''),
    coalesce(p_hvem, ''),
    coalesce(p_kostnad, ''),
    now()
  )
  ON CONFLICT (stortinget_issue_id) DO UPDATE SET
    hva = EXCLUDED.hva,
    hvem = EXCLUDED.hvem,
    kostnad = EXCLUDED.kostnad,
    updated_at = now();

  RETURN jsonb_build_object('ok', true, 'stortinget_issue_id', p_issue_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_save_document_embedding(
  p_chunk_id uuid,
  p_embedding text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

CREATE OR REPLACE FUNCTION public.n8n_finalize_document_storage(
  p_issue_id text,
  p_document_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
          AND c.embedding_status = 'pending'
      ) THEN 'pending'
      WHEN EXISTS (
        SELECT 1
        FROM public.document_chunks c
        WHERE c.issue_id = d.issue_id
          AND c.document_id = d.document_id
          AND c.embedding_status = 'ready'
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

CREATE OR REPLACE FUNCTION public.n8n_list_pending_document_chunks(
  p_issue_id text DEFAULT NULL,
  p_limit int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  issue_id text,
  document_id text,
  chunk_index int,
  content text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.issue_id,
    c.document_id,
    c.chunk_index,
    c.content
  FROM public.document_chunks c
  WHERE c.embedding_status = 'pending'
    AND (
      NULLIF(trim(coalesce(p_issue_id, '')), '') IS NULL
      OR c.issue_id = NULLIF(trim(p_issue_id), '')
    )
  ORDER BY c.created_at ASC
  LIMIT greatest(1, least(coalesce(p_limit, 8), 100));
$$;

CREATE OR REPLACE FUNCTION public.n8n_match_issue_document_chunks(
  p_issue_id text,
  p_query_embedding text,
  p_match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  document_id text,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.match_issue_document_chunks(
    p_issue_id,
    p_query_embedding::vector,
    p_match_count
  );
$$;

CREATE OR REPLACE FUNCTION public.n8n_list_sak_for_system_poll(p_issue_id text DEFAULT NULL)
RETURNS TABLE (
  issue_id text,
  issue_title text,
  issue_summary text,
  issue_category text,
  first_seen_at timestamptz,
  last_updated_at timestamptz,
  detail_excerpt text,
  ai_hva text,
  ai_hvem text,
  ai_kostnad text,
  documents json,
  existing_questions json
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
      AND EXISTS (
        SELECT 1
        FROM public.document_chunks dc
        WHERE dc.issue_id = i.id
          AND dc.embedding_status = 'ready'
          AND dc.embedding IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.polls p
        WHERE p.stortinget_issue_id = i.id
          AND p.status IN ('draft', 'open', 'closed')
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
    (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'document_id', d.document_id,
            'title', d.title,
            'document_type', d.document_type,
            'source_url', d.source_url
          )
          ORDER BY d.fetched_at DESC
        ),
        '[]'::json
      )
      FROM (
        SELECT document_id, title, document_type, source_url, fetched_at
        FROM public.stortinget_issue_documents
        WHERE issue_id = i.id
        ORDER BY fetched_at DESC
        LIMIT 6
      ) d
    ) AS documents,
    (
      SELECT COALESCE(
        json_agg(DISTINCT lower(trim(title))) FILTER (
          WHERE title IS NOT NULL AND trim(title) <> ''
        ),
        '[]'::json
      )
      FROM public.polls
      WHERE trim(title) <> '' AND status IN ('open', 'draft', 'closed')
    ) AS existing_questions
  FROM target t
  JOIN public.stortinget_issues i ON i.id = t.id
  LEFT JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id;
$$;

REVOKE ALL ON FUNCTION public.n8n_upsert_issue_ai_summary(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_save_document_embedding(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_finalize_document_storage(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_list_pending_document_chunks(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_match_issue_document_chunks(text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_list_sak_for_system_poll(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.n8n_upsert_issue_ai_summary(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_save_document_embedding(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_finalize_document_storage(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_list_pending_document_chunks(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_match_issue_document_chunks(text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_list_sak_for_system_poll(text) TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.issue_ai_summaries TO service_role;
GRANT SELECT, UPDATE ON public.document_chunks TO service_role;
GRANT SELECT, UPDATE ON public.stortinget_issue_documents TO service_role;

DROP POLICY IF EXISTS issue_ai_summaries_service_write ON public.issue_ai_summaries;
CREATE POLICY issue_ai_summaries_service_write
  ON public.issue_ai_summaries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS document_chunks_service_write ON public.document_chunks;
CREATE POLICY document_chunks_service_write
  ON public.document_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
