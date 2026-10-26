-- n8n source_items RPC: excerpt på list, seen_at på match (etter 20261021120000_content_feedback.sql).

DROP FUNCTION IF EXISTS public.n8n_list_source_items(text, timestamptz, int);

CREATE OR REPLACE FUNCTION public.n8n_list_source_items(
  p_domain text,
  p_since timestamptz DEFAULT NULL,
  p_limit int DEFAULT 500
)
RETURNS TABLE (
  id uuid,
  domain text,
  external_id text,
  url text,
  title text,
  excerpt varchar(400),
  categories text[],
  published_at timestamptz,
  modified_at timestamptz,
  has_embedding boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    si.id,
    si.domain,
    si.external_id,
    si.url,
    si.title,
    si.excerpt,
    si.categories,
    si.published_at,
    si.modified_at,
    (si.embedding IS NOT NULL) AS has_embedding
  FROM public.source_items si
  WHERE si.domain = public.normalize_content_source_domain(p_domain)
    AND (
      p_since IS NULL
      OR coalesce(si.modified_at, si.published_at, si.fetched_at) >= p_since
    )
  ORDER BY coalesce(si.modified_at, si.published_at, si.fetched_at) DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 500), 5000));
$$;

DROP FUNCTION IF EXISTS public.n8n_match_source_items(vector, int, int);

CREATE OR REPLACE FUNCTION public.n8n_match_source_items(
  p_embedding vector(1024),
  p_days int DEFAULT 14,
  p_k int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  domain text,
  external_id text,
  url text,
  title text,
  excerpt varchar(400),
  categories text[],
  published_at timestamptz,
  tier text,
  base_weight numeric(4, 2),
  similarity double precision,
  seen_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH query AS (
    SELECT public.assert_bge_m3_embedding(p_embedding) AS emb
  )
  SELECT
    si.id,
    si.domain,
    si.external_id,
    si.url,
    si.title,
    si.excerpt,
    si.categories,
    si.published_at,
    cs.tier,
    cs.base_weight,
    1 - (si.embedding <=> query.emb) AS similarity,
    coalesce(si.published_at, si.fetched_at) AS seen_at
  FROM public.source_items si
  JOIN public.content_sources cs ON cs.domain = si.domain
  CROSS JOIN query
  WHERE si.embedding IS NOT NULL
    AND cs.tier <> 'blocked'
    AND coalesce(si.published_at, si.fetched_at) >= now() - make_interval(days => greatest(coalesce(p_days, 14), 1))
  ORDER BY si.embedding <=> query.emb
  LIMIT greatest(coalesce(p_k, 5), 1);
$$;

REVOKE ALL ON FUNCTION public.n8n_list_source_items(text, timestamptz, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_list_source_items(text, timestamptz, int) TO service_role;

REVOKE ALL ON FUNCTION public.n8n_match_source_items(vector, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_match_source_items(vector, int, int) TO service_role;

NOTIFY pgrst, 'reload schema';
