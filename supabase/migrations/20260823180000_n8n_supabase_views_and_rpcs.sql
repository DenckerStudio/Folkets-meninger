-- n8n Supabase node helpers (PostgREST views + RPCs for ops the row node cannot express).

CREATE OR REPLACE VIEW public.n8n_issues_missing_ai_summary AS
SELECT
  i.id,
  i.title,
  i.summary,
  i.detail_json,
  i.last_synced_at
FROM public.stortinget_issues i
LEFT JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id
WHERE s.stortinget_issue_id IS NULL;

COMMENT ON VIEW public.n8n_issues_missing_ai_summary IS
  'n8n backfill queue: stortinget issues without issue_ai_summaries row';

GRANT SELECT ON public.n8n_issues_missing_ai_summary TO service_role;
GRANT SELECT ON public.n8n_issues_missing_ai_summary TO authenticated;
GRANT SELECT ON public.n8n_issues_missing_ai_summary TO anon;

DROP FUNCTION IF EXISTS public.n8n_list_issues_missing_ai_summary(int);

CREATE OR REPLACE FUNCTION public.n8n_list_issues_missing_ai_summary(p_limit int DEFAULT 1)
RETURNS TABLE (
  id text,
  title text,
  summary text,
  detail_json jsonb,
  last_synced_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.title,
    i.summary,
    i.detail_json,
    i.last_synced_at
  FROM public.stortinget_issues i
  LEFT JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id
  WHERE s.stortinget_issue_id IS NULL
  ORDER BY i.last_synced_at DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 1), 50));
$$;

REVOKE ALL ON FUNCTION public.n8n_list_issues_missing_ai_summary(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.n8n_list_issues_missing_ai_summary(int) TO service_role;

CREATE OR REPLACE FUNCTION public.n8n_upsert_issue_ai_summary(
  p_issue_id text,
  p_hva text,
  p_hvem text,
  p_kostnad text
)
RETURNS void
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
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_save_document_embedding(
  p_chunk_id uuid,
  p_embedding vector
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.document_chunks
  SET
    embedding = p_embedding,
    embedding_status = 'ready'
  WHERE id = p_chunk_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_finalize_document_storage(
  p_issue_id text,
  p_document_id text
)
RETURNS void
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
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_upsert_issue_ai_summary(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_save_document_embedding(uuid, vector) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_finalize_document_storage(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.n8n_upsert_issue_ai_summary(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_save_document_embedding(uuid, vector) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_finalize_document_storage(text, text) TO service_role;

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

REVOKE ALL ON FUNCTION public.n8n_list_pending_document_chunks(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.n8n_list_pending_document_chunks(text, int) TO service_role;
