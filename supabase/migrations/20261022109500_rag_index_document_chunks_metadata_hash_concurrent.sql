-- RUN OUTSIDE A TRANSACTION. CONCURRENTLY.

CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_metadata_content_hash_idx
  ON public.document_chunks (issue_id, document_id, ((metadata ->> 'content_hash')));

COMMENT ON INDEX public.document_chunks_metadata_content_hash_idx IS
  'Lookup chunks by ingest content_hash for re-chunk / re-embed backfill.';
