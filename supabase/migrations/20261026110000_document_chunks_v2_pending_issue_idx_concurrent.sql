-- RUN OUTSIDE A TRANSACTION (Coolify Expert / psql -f). CONCURRENTLY cannot run inside BEGIN.
-- Partial index for v2 backfill queue: per-issue chunk fetch and health counts.

CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_v2_pending_issue_idx
  ON public.document_chunks (issue_id, chunk_index)
  WHERE embedding_v2 IS NULL AND embedding_v2_status = 'pending';
