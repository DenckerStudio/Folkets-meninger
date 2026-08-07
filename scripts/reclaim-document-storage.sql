-- Emergency reclaim for exceed_db_size_quota (heyklever / self-hosted).
-- Run as a Postgres superuser / DB owner with enough headroom for VACUUM FULL.
--
-- Context: document_chunks + cached HTML/full text duplicated Stortinget bodies.
-- Embeddings MUST stay in Postgres (pgvector). n8n only orchestrates embedding writes.
--
-- Usage (example):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/reclaim-document-storage.sql
--
-- Prefer applying migration 20260807112603_document_chunks_storage_efficiency.sql
-- first when the DB accepts connections again. This script is safe either way.

BEGIN;

-- 1) Drop the largest duplicate: cached publication HTML (viewer fetches live).
UPDATE public.stortinget_issue_documents
SET content_html = NULL
WHERE content_html IS NOT NULL;

-- 2) Drop full text when RAG chunks already exist (chunk.content is the source of truth).
UPDATE public.stortinget_issue_documents d
SET content_full_text = NULL
WHERE d.content_full_text IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.document_chunks c
    WHERE c.issue_id = d.issue_id
      AND c.document_id = d.document_id
      AND c.embedding_status = 'ready'
  );

-- 3) Optional: set chunks_status when column exists (post-migration).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stortinget_issue_documents'
      AND column_name = 'chunks_status'
  ) THEN
    UPDATE public.stortinget_issue_documents d
    SET chunks_status = 'ready'
    WHERE EXISTS (
      SELECT 1
      FROM public.document_chunks c
      WHERE c.issue_id = d.issue_id
        AND c.document_id = d.document_id
        AND c.embedding_status = 'ready'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.document_chunks c
      WHERE c.issue_id = d.issue_id
        AND c.document_id = d.document_id
        AND c.embedding_status = 'pending'
    );
  END IF;
END $$;

-- 4) Optional nuclear option if still over quota (requires re-ingest + re-embed):
-- TRUNCATE public.document_chunks;
-- UPDATE public.stortinget_issue_documents
-- SET content_html = NULL, content_full_text = NULL, ingest_status = 'pending'
-- WHERE ingest_status = 'ready';

COMMIT;

VACUUM (FULL, ANALYZE) public.stortinget_issue_documents;
VACUUM (FULL, ANALYZE) public.document_chunks;

SELECT
  relname,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND relname IN ('document_chunks', 'stortinget_issue_documents')
ORDER BY pg_total_relation_size(c.oid) DESC;
