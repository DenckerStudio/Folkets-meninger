-- Liknende saker på sak-side: nærmeste andre saker via embedding_v2 (HNSW på document_chunks).
--
-- Dry-run (prod read-only; erstatt issue-id):
--   SELECT id, title, sak_sesjon, ferdigbehandlet, similarity
--   FROM public.search_similar_stortinget_issues('12345', 5);

BEGIN;

CREATE OR REPLACE FUNCTION public.search_similar_stortinget_issues(
  p_issue_id text,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id text,
  title text,
  sak_sesjon text,
  ferdigbehandlet boolean,
  similarity real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_issue text := nullif(btrim(coalesce(p_issue_id, '')), '');
  v_limit int := greatest(1, least(coalesce(match_count, 5), 5));
  v_probe int := 200;
BEGIN
  PERFORM set_config('statement_timeout', '3500', true);

  IF v_issue IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH rep AS (
    SELECT avg(dc.embedding_v2)::vector(1024) AS vec
    FROM public.document_chunks dc
    WHERE dc.issue_id = v_issue
      AND dc.embedding_v2 IS NOT NULL
    HAVING count(*) > 0
  ),
  nearest AS (
    SELECT
      dc.issue_id,
      (1 - (dc.embedding_v2 <=> (SELECT vec FROM rep)))::real AS sim
    FROM public.document_chunks dc
    WHERE (SELECT vec FROM rep) IS NOT NULL
      AND dc.embedding_v2 IS NOT NULL
      AND dc.issue_id IS NOT NULL
      AND dc.issue_id <> v_issue
    ORDER BY dc.embedding_v2 <=> (SELECT vec FROM rep)
    LIMIT v_probe
  ),
  by_issue AS (
    SELECT n.issue_id, max(n.sim) AS similarity
    FROM nearest n
    GROUP BY n.issue_id
    HAVING max(n.sim) >= 0.55
  )
  SELECT
    i.id,
    coalesce(nullif(btrim(i.title), ''), i.id) AS title,
    coalesce(
      nullif(btrim(i.detail_json->>'sak_sesjon'), ''),
      nullif(btrim(i.detail_json->>'sesjon_id'), '')
    ) AS sak_sesjon,
    i.ferdigbehandlet,
    b.similarity
  FROM by_issue b
  JOIN public.stortinget_issues i ON i.id = b.issue_id
  ORDER BY b.similarity DESC, i.id
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_similar_stortinget_issues(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_similar_stortinget_issues(text, int) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;