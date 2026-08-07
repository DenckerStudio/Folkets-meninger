-- Slim RAG storage:
-- 1) Track chunk lifecycle on documents (n8n owns chunking + embedding).
-- 2) Drop cached HTML bodies (viewer fetches live from Stortinget).
-- 3) Drop full document text once chunks exist (chunk.content is the RAG source).
--
-- Note: n8n is NOT a vector store — embeddings stay in Postgres (pgvector) for
-- match_issue_document_chunks. This migration reduces duplicate text storage.

ALTER TABLE public.stortinget_issue_documents
  ADD COLUMN IF NOT EXISTS chunks_status text NOT NULL DEFAULT 'none';

COMMENT ON COLUMN public.stortinget_issue_documents.chunks_status IS
  'none | pending | ready | failed — n8n chunks+embeds from content_full_text, then clears body text';

COMMENT ON COLUMN public.stortinget_issue_documents.content_html IS
  'Deprecated cache. Prefer live Stortinget fetch; reclaim scripts null this column.';

COMMENT ON COLUMN public.stortinget_issue_documents.content_full_text IS
  'Temporary plain text for n8n chunking. Cleared when chunks_status=ready.';

CREATE INDEX IF NOT EXISTS stortinget_issue_documents_chunks_pending_idx
  ON public.stortinget_issue_documents (chunks_status, fetched_at)
  WHERE chunks_status = 'pending';

-- Backfill chunk status from existing embeddings.
UPDATE public.stortinget_issue_documents d
SET chunks_status = CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.document_chunks c
    WHERE c.issue_id = d.issue_id
      AND c.document_id = d.document_id
      AND c.embedding_status = 'ready'
      AND c.embedding IS NOT NULL
  ) THEN 'ready'
  WHEN EXISTS (
    SELECT 1
    FROM public.document_chunks c
    WHERE c.issue_id = d.issue_id
      AND c.document_id = d.document_id
  ) THEN 'pending'
  WHEN d.ingest_status = 'ready'
    AND d.content_full_text IS NOT NULL
    AND length(trim(d.content_full_text)) > 0
    THEN 'pending'
  ELSE 'none'
END
WHERE d.chunks_status = 'none';

-- Immediate reclaim: HTML is the largest duplicate (viewer can re-fetch).
UPDATE public.stortinget_issue_documents
SET content_html = NULL
WHERE content_html IS NOT NULL;

-- Drop full text when RAG chunks already exist (keeps one copy in document_chunks).
UPDATE public.stortinget_issue_documents d
SET content_full_text = NULL
WHERE d.content_full_text IS NOT NULL
  AND d.chunks_status = 'ready';

-- Ops helper: reclaim document bodies after embeddings are ready.
CREATE OR REPLACE FUNCTION public.reclaim_document_body_storage()
RETURNS TABLE (
  cleared_html bigint,
  cleared_full_text bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
          AND c.embedding_status = 'ready'
      )
    );
  GET DIAGNOSTICS text_count = ROW_COUNT;

  RETURN QUERY SELECT html_count, text_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reclaim_document_body_storage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reclaim_document_body_storage() TO service_role;
