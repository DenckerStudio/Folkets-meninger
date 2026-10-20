CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
END $$;

CREATE TABLE public.stortinget_issues (
  id text PRIMARY KEY
);

CREATE TABLE public.stortinget_issue_documents (
  issue_id text NOT NULL REFERENCES public.stortinget_issues (id) ON DELETE CASCADE,
  document_id text NOT NULL,
  title text,
  document_type text,
  source_url text,
  content_hash text,
  content_markdown text,
  markdown_source text,
  page_count int,
  ingest_version text,
  chunker text,
  pdf_url text,
  ingest_status text NOT NULL DEFAULT 'pending',
  chunks_status text NOT NULL DEFAULT 'pending',
  fetched_at timestamptz,
  PRIMARY KEY (issue_id, document_id)
);

CREATE TABLE public.stortinget_hearings (
  id text PRIMARY KEY
);

CREATE TABLE public.hearing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hearing_id text NOT NULL REFERENCES public.stortinget_hearings (id) ON DELETE CASCADE,
  external_key text NOT NULL,
  title text,
  kind text,
  document_kind text,
  source_url text,
  pdf_url text,
  markdown text,
  content_markdown text,
  content_hash text,
  chunker text,
  page_count int,
  ingest_status text NOT NULL DEFAULT 'pending',
  chunks_status text NOT NULL DEFAULT 'pending',
  status text,
  fetched_at timestamptz,
  updated_at timestamptz,
  UNIQUE (hearing_id, external_key)
);

CREATE TABLE public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id text REFERENCES public.stortinget_issues (id) ON DELETE CASCADE,
  document_id text,
  chunk_index int NOT NULL,
  content text NOT NULL,
  embedding_status text NOT NULL DEFAULT 'pending',
  metadata jsonb,
  hearing_id text REFERENCES public.stortinget_hearings (id) ON DELETE CASCADE,
  hearing_document_id uuid REFERENCES public.hearing_documents (id) ON DELETE CASCADE,
  embedding text,
  embedding_v2 text,
  embedding_v2_status text NOT NULL DEFAULT 'pending',
  embedding_v2_attempts int NOT NULL DEFAULT 0,
  CONSTRAINT document_chunks_issue_id_document_id_chunk_index_key
    UNIQUE (issue_id, document_id, chunk_index),
  CONSTRAINT document_chunks_sak_or_hearing_check CHECK (
    (issue_id IS NOT NULL AND hearing_document_id IS NULL)
    OR (hearing_document_id IS NOT NULL AND issue_id IS NULL)
  )
);

CREATE UNIQUE INDEX document_chunks_hearing_doc_chunk_key
  ON public.document_chunks (hearing_document_id, chunk_index)
  WHERE hearing_document_id IS NOT NULL;

INSERT INTO public.stortinget_issues (id) VALUES ('sak-1');
INSERT INTO public.stortinget_hearings (id) VALUES ('horing-1');
