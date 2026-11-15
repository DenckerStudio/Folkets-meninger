-- Prod repair: public.stortinget_issue_documents lost columns from
-- 20260807112603_document_chunks_storage_efficiency.sql and
-- 20261022103000_docling_ingest_and_embedding_v2_rpcs.sql (never applied in prod).
-- fm-web document ingest upserts chunks_status; missing columns caused silent upsert
-- failures (Postgres 42703) and an empty document table while chunks still wrote.
--
-- Idempotent: safe to re-run (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
-- No data deletes or backfill — table is empty; sak sync repopulates rows after apply.
--
-- Dry-run (psql, rolls back):
--   BEGIN;
--   \i supabase/migrations/20261115020000_stortinget_issue_documents_missing_columns.sql
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name = 'stortinget_issue_documents'
--     AND column_name IN (
--       'content_html', 'content_full_text', 'mime_type', 'ingest_status',
--       'chunks_status', 'content_markdown', 'markdown_source', 'page_count',
--       'ingest_version', 'chunker', 'pdf_url'
--     )
--   ORDER BY column_name;
--   ROLLBACK;

ALTER TABLE public.stortinget_issue_documents
  ADD COLUMN IF NOT EXISTS content_html text,
  ADD COLUMN IF NOT EXISTS content_full_text text,
  ADD COLUMN IF NOT EXISTS mime_type text DEFAULT 'text/html',
  ADD COLUMN IF NOT EXISTS ingest_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS chunks_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS content_markdown text,
  ADD COLUMN IF NOT EXISTS markdown_source text,
  ADD COLUMN IF NOT EXISTS page_count int,
  ADD COLUMN IF NOT EXISTS ingest_version text,
  ADD COLUMN IF NOT EXISTS chunker text,
  ADD COLUMN IF NOT EXISTS pdf_url text;

COMMENT ON COLUMN public.stortinget_issue_documents.chunks_status IS
  'none | pending | ready | failed — n8n chunks+embeds from content_full_text, then clears body text';

COMMENT ON COLUMN public.stortinget_issue_documents.content_html IS
  'Deprecated cache. Prefer live Stortinget fetch; reclaim scripts null this column.';

COMMENT ON COLUMN public.stortinget_issue_documents.content_full_text IS
  'Temporary plain text for n8n chunking. Cleared when chunks_status=ready.';

CREATE INDEX IF NOT EXISTS stortinget_issue_documents_chunks_pending_idx
  ON public.stortinget_issue_documents (chunks_status, fetched_at)
  WHERE chunks_status = 'pending';