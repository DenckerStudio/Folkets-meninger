-- Sak documents: cached HTML/text + RAG chunks (pgvector)

ALTER TABLE public.stortinget_issue_documents
  ADD COLUMN IF NOT EXISTS content_html text,
  ADD COLUMN IF NOT EXISTS content_full_text text,
  ADD COLUMN IF NOT EXISTS mime_type text DEFAULT 'text/html',
  ADD COLUMN IF NOT EXISTS ingest_status text NOT NULL DEFAULT 'pending';

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id text NOT NULL REFERENCES public.stortinget_issues (id) ON DELETE CASCADE,
  document_id text NOT NULL,
  chunk_index int NOT NULL,
  content text NOT NULL,
  embedding vector(768),
  embedding_status text NOT NULL DEFAULT 'pending',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issue_id, document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS document_chunks_issue_id_idx
  ON public.document_chunks (issue_id);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_pending_idx
  ON public.document_chunks (embedding_status)
  WHERE embedding_status = 'pending';

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_chunks_select_all ON public.document_chunks;
CREATE POLICY document_chunks_select_all
  ON public.document_chunks
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.match_issue_document_chunks(
  p_issue_id text,
  p_query_embedding vector(768),
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
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> p_query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE dc.issue_id = p_issue_id
    AND dc.embedding IS NOT NULL
    AND dc.embedding_status = 'ready'
  ORDER BY dc.embedding <=> p_query_embedding
  LIMIT GREATEST(p_match_count, 1);
$$;
