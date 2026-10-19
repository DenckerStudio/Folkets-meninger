-- RAG improvement round 1: sak search (exact/ID/refs), weighted FTS, metadata boost, chunk→sak aggregate.
-- Does not modify earlier 2026101920xxxx migrations.

BEGIN;

DROP FUNCTION IF EXISTS public.search_issues_fts(text, int);
DROP FUNCTION IF EXISTS public.search_issues_fts(text, text[], int);

CREATE OR REPLACE FUNCTION public.search_issues_fts(
  query_text text,
  search_terms text[] DEFAULT NULL,
  match_count int DEFAULT 6
)
RETURNS TABLE (
  id text,
  title text,
  summary text,
  henvisning text,
  ferdigbehandlet boolean,
  rank real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH prefix_query AS (
    SELECT CASE
      WHEN search_terms IS NULL OR cardinality(search_terms) = 0 THEN NULL::tsquery
      ELSE (
        SELECT CASE
          WHEN coalesce(prefix_expr, '') = '' THEN NULL::tsquery
          ELSE to_tsquery('norwegian', prefix_expr)
        END
        FROM (
          SELECT string_agg(lexeme || ':*', ' | ' ORDER BY lexeme) AS prefix_expr
          FROM (
            SELECT DISTINCT lower(btrim(part)) AS lexeme
            FROM unnest(search_terms) AS u(t)
            CROSS JOIN LATERAL regexp_split_to_table(coalesce(t, ''), '[^[:alnum:]]+') AS part
            WHERE char_length(btrim(part)) >= 2
          ) splits
        ) built
      )
    END AS tsq
  ),
  q AS (
    SELECT
      nullif(btrim(coalesce(query_text, '')), '') AS raw,
      lower(nullif(btrim(coalesce(query_text, '')), '')) AS raw_lower,
      coalesce(
        (SELECT tsq FROM prefix_query),
        CASE
          WHEN nullif(btrim(coalesce(query_text, '')), '') IS NULL THEN NULL::tsquery
          ELSE websearch_to_tsquery('norwegian', nullif(btrim(coalesce(query_text, '')), ''))
        END
      ) AS tsq
  ),
  refs AS (
    SELECT
      q.raw,
      (regexp_match(q.raw, '^\s*(\d{4,10})\s*$'))[1] AS issue_id,
      (regexp_match(q.raw, '^\s*(\d{7,12})\s*$'))[1] AS hearing_id,
      (regexp_match(q.raw, 'prop\.?\s*(\d+)\s*([a-z])?', 'i')) AS prop_m,
      (regexp_match(q.raw, 'innst\.?\s*(\d+)\s*([a-z])?', 'i')) AS innst_m,
      (regexp_match(q.raw, 'dok(?:ument)?\.?\s*(\d+)\s*:\s*(\d+)\s*([a-z])?', 'i')) AS dok_m
    FROM q
  ),
  exact_issue AS (
    SELECT i.id, i.title, left(coalesce(i.summary, ''), 400) AS summary, i.henvisning, i.ferdigbehandlet,
      1000::real AS rank
    FROM public.stortinget_issues i
    CROSS JOIN refs r
    WHERE r.issue_id IS NOT NULL AND i.id = r.issue_id
  ),
  hearing_issues AS (
    SELECT i.id, i.title, left(coalesce(i.summary, ''), 400) AS summary, i.henvisning, i.ferdigbehandlet,
      950::real AS rank
    FROM public.stortinget_hearings h
    CROSS JOIN refs r
    CROSS JOIN LATERAL unnest(h.related_issue_ids) AS rid(issue_id)
    JOIN public.stortinget_issues i ON i.id = rid.issue_id
    WHERE r.hearing_id IS NOT NULL AND h.id = r.hearing_id
  ),
  ref_henvisning AS (
    SELECT i.id, i.title, left(coalesce(i.summary, ''), 400) AS summary, i.henvisning, i.ferdigbehandlet,
      900::real AS rank
    FROM public.stortinget_issues i
    CROSS JOIN refs r
    WHERE (
      (r.prop_m IS NOT NULL AND (
        coalesce(i.henvisning, '') ILIKE '%Prop. ' || r.prop_m[1] || '%'
        OR coalesce(i.title, '') ILIKE '%Prop. ' || r.prop_m[1] || '%'
      ))
      OR (r.innst_m IS NOT NULL AND (
        coalesce(i.henvisning, '') ILIKE '%Innst. ' || r.innst_m[1] || '%'
        OR coalesce(i.title, '') ILIKE '%Innst. ' || r.innst_m[1] || '%'
      ))
      OR (r.dok_m IS NOT NULL AND (
        coalesce(i.henvisning, '') ILIKE '%' || r.dok_m[1] || ':' || r.dok_m[2] || '%'
        OR coalesce(i.title, '') ILIKE '%Dokument ' || r.dok_m[1] || ':' || r.dok_m[2] || '%'
      ))
    )
  ),
  short_place AS (
    SELECT i.id, i.title, left(coalesce(i.summary, ''), 400) AS summary, i.henvisning, i.ferdigbehandlet,
      850::real AS rank
    FROM public.stortinget_issues i
    CROSS JOIN q
    WHERE char_length(q.raw) = 2
      AND (
        lower(i.title) = q.raw_lower
        OR lower(i.title) LIKE q.raw_lower || ' %'
        OR lower(i.title) LIKE '% ' || q.raw_lower || ' %'
        OR lower(i.title) LIKE '% ' || q.raw_lower
      )
  ),
  fts_issue AS (
    SELECT
      i.id,
      i.title,
      left(coalesce(i.summary, ''), 400) AS summary,
      i.henvisning,
      i.ferdigbehandlet,
      (
        ts_rank_cd(i.tsv, q.tsq, 1)::real
        + CASE WHEN coalesce(nullif(trim(i.detail_json->>'sak_sesjon'), ''), nullif(trim(i.detail_json->>'sesjon_id'), '')) IS NOT NULL
            AND q.raw ~* coalesce(nullif(trim(i.detail_json->>'sak_sesjon'), ''), nullif(trim(i.detail_json->>'sesjon_id'), ''))
          THEN 0.12 ELSE 0 END
        + CASE WHEN nullif(trim(i.detail_json->'komite'->>'navn'), '') IS NOT NULL
            AND q.raw ILIKE '%' || nullif(trim(i.detail_json->'komite'->>'navn'), '') || '%'
          THEN 0.1 ELSE 0 END
      )::real AS rank
    FROM public.stortinget_issues i
    CROSS JOIN q
    WHERE q.raw IS NOT NULL
      AND q.tsq IS NOT NULL
      AND i.tsv @@ q.tsq
  ),
  chunk_sak AS (
    SELECT
      dc.issue_id AS id,
      max(ts_rank_cd(dc.tsv, q.tsq, 1))::real AS chunk_rank
    FROM public.document_chunks dc
    CROSS JOIN q
    WHERE q.tsq IS NOT NULL AND dc.tsv @@ q.tsq AND dc.issue_id IS NOT NULL
    GROUP BY dc.issue_id
  ),
  chunk_boosted AS (
    SELECT
      i.id,
      i.title,
      left(coalesce(i.summary, ''), 400) AS summary,
      i.henvisning,
      i.ferdigbehandlet,
      (c.chunk_rank * 0.85 + 0.05)::real AS rank
    FROM chunk_sak c
    JOIN public.stortinget_issues i ON i.id = c.id
  ),
  merged AS (
    SELECT * FROM exact_issue
    UNION ALL
    SELECT * FROM hearing_issues
    UNION ALL
    SELECT * FROM ref_henvisning
    UNION ALL
    SELECT * FROM short_place
    UNION ALL
    SELECT * FROM fts_issue
    UNION ALL
    SELECT * FROM chunk_boosted
  ),
  deduped AS (
    SELECT DISTINCT ON (m.id)
      m.id, m.title, m.summary, m.henvisning, m.ferdigbehandlet, m.rank
    FROM merged m
    ORDER BY m.id, m.rank DESC
  )
  SELECT d.id, d.title, d.summary, d.henvisning, d.ferdigbehandlet, d.rank
  FROM deduped d
  ORDER BY d.rank DESC, d.id
  LIMIT GREATEST(coalesce(match_count, 6), 1);
$$;

REVOKE ALL ON FUNCTION public.search_issues_fts(text, text[], int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_issues_fts(text, text[], int) TO anon, authenticated;

COMMIT;
