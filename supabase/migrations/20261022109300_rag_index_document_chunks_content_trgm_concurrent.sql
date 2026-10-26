-- RUN OUTSIDE A TRANSACTION. CONCURRENTLY.
-- Requires: pg_trgm in schema extensions (20261022105000).

CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_content_trgm_idx
  ON public.document_chunks USING gin (content extensions.gin_trgm_ops);
