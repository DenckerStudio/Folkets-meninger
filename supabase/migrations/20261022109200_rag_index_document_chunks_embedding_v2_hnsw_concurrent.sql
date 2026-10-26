-- RUN OUTSIDE A TRANSACTION. CONCURRENTLY.
-- Prod: builds HNSW on rows where embedding_v2 IS NOT NULL (starts empty; grows with n8n backfill).
-- Partial index — safe to create before backfill; expect longer build as rows populate.

CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_embedding_v2_hnsw_idx
  ON public.document_chunks
  USING hnsw (embedding_v2 vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding_v2 IS NOT NULL;
