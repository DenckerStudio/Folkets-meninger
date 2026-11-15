-- Rett polls.stortinget_issue_id som peker på research-topic:* når ekte sak kan avledes.
-- Manuell apply på prod (Coolify Expert: backup + dry-run før merge).

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.research_topic_derived_stortinget_issue_id(p_topic_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT nullif(btrim(rt.stortinget_issue_id), '')
      FROM public.research_topics rt
      WHERE rt.id = p_topic_id
        AND nullif(btrim(rt.stortinget_issue_id), '') IS NOT NULL
        AND btrim(rt.stortinget_issue_id) NOT LIKE 'research-topic:%'
    ),
    (
      SELECT nullif(btrim(ac.related_issue_id), '')
      FROM public.research_topics rt
      INNER JOIN public.action_clusters ac ON ac.id = rt.cluster_id
      WHERE rt.id = p_topic_id
        AND rt.source_kind = 'cluster'
        AND nullif(btrim(ac.related_issue_id), '') IS NOT NULL
        AND btrim(ac.related_issue_id) NOT LIKE 'research-topic:%'
      LIMIT 1
    ),
    (
      SELECT nullif(btrim(rs.related_issue_id), '')
      FROM public.research_topics rt
      INNER JOIN public.reddit_signals rs ON rs.id = rt.reddit_signal_id
      WHERE rt.id = p_topic_id
        AND rt.source_kind = 'reddit'
        AND nullif(btrim(rs.related_issue_id), '') IS NOT NULL
        AND btrim(rs.related_issue_id) NOT LIKE 'research-topic:%'
      LIMIT 1
    )
  );
$$;

COMMENT ON FUNCTION public.research_topic_derived_stortinget_issue_id(uuid) IS
  'Ekte Stortinget-sak for research topic (ikke research-topic: pseudo-id).';

REVOKE ALL ON FUNCTION public.research_topic_derived_stortinget_issue_id(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.research_topic_derived_stortinget_issue_id(uuid)
  TO service_role;

-- Dry-run / forhåndsvisning (kjør alene på prod før UPDATE):
-- SELECT p.id AS poll_id,
--        p.title,
--        p.stortinget_issue_id AS current_issue_id,
--        rt.id AS topic_id,
--        public.research_topic_derived_stortinget_issue_id(
--          coalesce(
--            rt.id,
--            CASE
--              WHEN p.stortinget_issue_id LIKE 'research-topic:%'
--              THEN substring(p.stortinget_issue_id FROM 16)::uuid
--              ELSE NULL
--            END
--          )
--        ) AS derived_issue_id
-- FROM public.polls p
-- LEFT JOIN public.research_topics rt ON rt.stortinget_poll_id = p.id
-- WHERE p.stortinget_issue_id LIKE 'research-topic:%'
-- ORDER BY p.created_at DESC;

UPDATE public.polls AS p
SET stortinget_issue_id = derived.issue_id,
    updated_at = now()
FROM (
  SELECT
    p2.id AS poll_id,
    public.research_topic_derived_stortinget_issue_id(
      coalesce(
        rt.id,
        CASE
          WHEN p2.stortinget_issue_id LIKE 'research-topic:%'
          THEN substring(p2.stortinget_issue_id FROM 16)::uuid
          ELSE NULL
        END
      )
    ) AS issue_id
  FROM public.polls p2
  LEFT JOIN public.research_topics rt ON rt.stortinget_poll_id = p2.id
  WHERE p2.stortinget_issue_id LIKE 'research-topic:%'
) AS derived
WHERE p.id = derived.poll_id
  AND derived.issue_id IS NOT NULL
  AND btrim(derived.issue_id) <> ''
  AND derived.issue_id NOT LIKE 'research-topic:%'
  AND p.stortinget_issue_id IS DISTINCT FROM derived.issue_id;

COMMIT;