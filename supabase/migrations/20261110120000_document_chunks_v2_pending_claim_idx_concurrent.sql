-- RUN OUTSIDE A TRANSACTION (CONCURRENTLY). Do not wrap in BEGIN/COMMIT.
-- Supports claim / tier discovery: DISTINCT issue_id on v2-pending sak-chunks.
-- Predicate matches partial index for planner (issue_id IS NOT NULL on sak rows).
--
-- Before apply (same GUCs as 26110000 — see EMBEDDING_V2_QUEUE_APPLY.md):
--   SET lock_timeout = '30s';
--   SET statement_timeout = 0;
--   SET maintenance_work_mem = '1GB';
--   SET max_parallel_maintenance_workers = 0;
--
-- Apply (example):
--   psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261110120000_document_chunks_v2_pending_claim_idx_concurrent.sql
--
-- Invalid-index check (expect zero rows):
--   SELECT c.relname, i.indisvalid
--   FROM pg_index i
--   JOIN pg_class c ON c.oid = i.indexrelid
--   WHERE c.relname = 'document_chunks_v2_pending_claim_idx' AND NOT i.indisvalid;
--
-- If invalid: DROP INDEX CONCURRENTLY IF EXISTS public.document_chunks_v2_pending_claim_idx;
-- then re-run this file with statement_timeout = 0.

CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_v2_pending_claim_idx
  ON public.document_chunks (issue_id)
  INCLUDE (embedding_v2_claimed_at, embedding_v2_attempts)
  WHERE embedding_v2 IS NULL
    AND embedding_v2_status = 'pending'
    AND issue_id IS NOT NULL;
