-- RUN OUTSIDE A TRANSACTION. CONCURRENTLY.
-- Prod: stortinget_issues ~480 rows — typically seconds.
-- Requires: stortinget_issues.tsv (final definition from 20261022106000).

CREATE INDEX CONCURRENTLY IF NOT EXISTS stortinget_issues_tsv_gin_idx
  ON public.stortinget_issues USING gin (tsv);
