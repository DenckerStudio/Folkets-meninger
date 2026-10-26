-- RUN OUTSIDE A TRANSACTION (Coolify Expert / psql -f). CONCURRENTLY cannot run inside BEGIN.
-- Partial index for v2 backfill queue: per-issue chunk fetch, health counts, and lease claims
-- (predicate does not reference claim columns; expired leases remain in the partial index).
--
-- Before apply (same GUCs as PR #185 phase B — see EMBEDDING_V2_QUEUE_APPLY.md):
--   SET lock_timeout = '30s';
--   SET statement_timeout = 0;
--   SET maintenance_work_mem = '1GB';
--   SET max_parallel_maintenance_workers = 0;
--
-- After apply — invalid-index check (expect zero rows):
--   SELECT c.relname, i.indisvalid FROM pg_index i
--   JOIN pg_class c ON c.oid = i.indexrelid
--   WHERE c.relname = 'document_chunks_v2_pending_issue_idx' AND NOT i.indisvalid;
-- If invalid: DROP INDEX CONCURRENTLY IF EXISTS public.document_chunks_v2_pending_issue_idx;
-- then re-run this file with statement_timeout = 0.

CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_v2_pending_issue_idx
  ON public.document_chunks (issue_id, chunk_index)
  WHERE embedding_v2 IS NULL AND embedding_v2_status = 'pending';
