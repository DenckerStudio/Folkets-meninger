-- RUN OUTSIDE A TRANSACTION (Coolify Expert / psql -f). CONCURRENTLY cannot run inside BEGIN.
-- Prod: document_chunks ~380k rows / ~814 MB — expect tens of minutes CPU/IO; no long ACCESS EXCLUSIVE lock.
-- Requires: document_chunks.tsv column from 20261022100000.

CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_tsv_gin_idx
  ON public.document_chunks USING gin (tsv);
