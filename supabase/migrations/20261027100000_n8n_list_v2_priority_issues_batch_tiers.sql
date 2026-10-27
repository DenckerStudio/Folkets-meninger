-- TRANSACTIONAL (BEGIN/COMMIT). Apply after 20261027090000 (see EMBEDDING_V2_QUEUE_APPLY.md step 7).
-- Fixes prod statement_timeout on n8n_list_v2_priority_issues: tier was computed per distinct issue (~thousands).
-- Uses set-based fm_embedding_v2_issue_tiers(text[]) (same pattern as n8n_claim_chunks_missing_v2 perf).
--
-- Coolify verify:
--   SET ROLE service_role;
--   SET statement_timeout = '8s';
--   SELECT count(*) FROM n8n_list_v2_priority_issues(0, 1, 0, 1);

BEGIN;

CREATE OR REPLACE FUNCTION public.n8n_list_v2_priority_issues(
  p_tier int,
  p_limit int DEFAULT 50,
  p_worker_index int DEFAULT 0,
  p_worker_count int DEFAULT 1
)
RETURNS TABLE (
  issue_id text,
  pending_chunks int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH limits AS (
    SELECT
      greatest(1, least(coalesce(p_limit, 50), 500)) AS lim,
      greatest(1, coalesce(p_worker_count, 1)) AS wcount,
      greatest(0, least(coalesce(p_worker_index, 0), greatest(1, coalesce(p_worker_count, 1)) - 1)) AS windex
  ),
  issues AS (
    SELECT DISTINCT c.issue_id
    FROM public.document_chunks c
    WHERE c.issue_id IS NOT NULL
      AND c.embedding_v2 IS NULL
      AND c.embedding_v2_status = 'pending'
      AND coalesce(btrim(c.content), '') <> ''
  ),
  issue_ids AS MATERIALIZED (
    SELECT coalesce(array_agg(i.issue_id ORDER BY i.issue_id), ARRAY[]::text[]) AS ids
    FROM issues i
  ),
  tiered AS (
    SELECT t.issue_id, t.tier
    FROM public.fm_embedding_v2_issue_tiers((SELECT ids FROM issue_ids)) t
    WHERE t.tier = p_tier
  ),
  scored AS (
    SELECT
      t.issue_id,
      count(*)::int AS pending_chunks
    FROM tiered t
    JOIN public.document_chunks c ON c.issue_id = t.issue_id
      AND c.embedding_v2 IS NULL
      AND c.embedding_v2_status = 'pending'
      AND coalesce(btrim(c.content), '') <> ''
    CROSS JOIN limits l
    WHERE (
      l.wcount <= 1
      OR abs(hashtext(t.issue_id)) % l.wcount = l.windex
    )
    GROUP BY t.issue_id
  )
  SELECT s.issue_id, s.pending_chunks
  FROM scored s
  CROSS JOIN limits l
  ORDER BY s.pending_chunks DESC, s.issue_id ASC
  LIMIT (SELECT lim FROM limits);
$$;

REVOKE ALL ON FUNCTION public.n8n_list_v2_priority_issues(int, int, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_list_v2_priority_issues(int, int, int, int) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
