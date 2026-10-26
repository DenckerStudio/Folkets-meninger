-- RAG eval schema (baseline / main): derived from supabase/migrations sak + chunk tables.

CREATE TABLE IF NOT EXISTS public.stortinget_issues (
  id text PRIMARY KEY,
  title text,
  summary text,
  henvisning text,
  ferdigbehandlet boolean,
  status text DEFAULT 'pending',
  last_synced_at timestamptz,
  first_seen_at timestamptz DEFAULT now(),
  detail_json jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.stortinget_issue_documents (
  issue_id text NOT NULL REFERENCES public.stortinget_issues (id) ON DELETE CASCADE,
  document_id text NOT NULL,
  title text,
  document_type text,
  source_url text,
  content_full_text text,
  ingest_status text NOT NULL DEFAULT 'ready',
  PRIMARY KEY (issue_id, document_id)
);

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
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

CREATE INDEX IF NOT EXISTS document_chunks_issue_id_idx ON public.document_chunks (issue_id);

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
    (1 - (dc.embedding <=> p_query_embedding))::float AS similarity
  FROM public.document_chunks dc
  WHERE dc.issue_id = p_issue_id
    AND dc.embedding IS NOT NULL
    AND dc.embedding_status = 'ready'
  ORDER BY dc.embedding <=> p_query_embedding
  LIMIT GREATEST(p_match_count, 1);
$$;

GRANT EXECUTE ON FUNCTION public.match_issue_document_chunks(text, vector, int) TO anon, authenticated;
