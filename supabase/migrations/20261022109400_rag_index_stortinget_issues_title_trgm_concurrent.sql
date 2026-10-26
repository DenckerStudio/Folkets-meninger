-- RUN OUTSIDE A TRANSACTION. CONCURRENTLY.

CREATE INDEX CONCURRENTLY IF NOT EXISTS stortinget_issues_title_trgm_idx
  ON public.stortinget_issues USING gin (title extensions.gin_trgm_ops);
