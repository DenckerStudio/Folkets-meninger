-- Reddit Research fase 3: aggregert læringsstatistikk for admin (n≥5 per gruppe).

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE VIEW public.reddit_learning_stats
WITH (security_invoker = true) AS
WITH enriched AS (
  SELECT
    rs.id,
    rs.subreddit,
    COALESCE(NULLIF(trim(rs.topic), ''), '(uten tema)') AS topic_key,
    COALESCE(NULLIF(trim(rs.link_domain), ''), '(uten domene)') AS link_domain_key,
    rs.status,
    rs.ai_relevance,
    (
      rs.status = 'brukt'
      OR EXISTS (
        SELECT 1
        FROM public.research_topics rt
        WHERE rt.reddit_signal_id = rs.id
      )
    ) AS effective_brukt
  FROM public.reddit_signals rs
),
by_subreddit AS (
  SELECT
    'subreddit'::text AS dimension,
    e.subreddit::text AS group_key,
    count(*)::int AS total,
    count(*) FILTER (WHERE e.effective_brukt)::int AS brukt,
    count(*) FILTER (WHERE e.status = 'ignorert')::int AS ignorert,
    count(*) FILTER (WHERE e.status = 'auto_ignorert')::int AS auto_ignorert,
    count(*) FILTER (WHERE e.status = 'blokkert')::int AS blokkert,
  round(avg(e.ai_relevance) FILTER (WHERE e.ai_relevance IS NOT NULL), 2) AS avg_ai_relevance,
  CASE
    WHEN count(*) = 0 THEN NULL::numeric
    ELSE round(
      (count(*) FILTER (WHERE e.effective_brukt)::numeric / count(*)::numeric),
      4
    )
  END AS brukt_rate
  FROM enriched e
  GROUP BY e.subreddit
  HAVING count(*) >= 5
),
by_topic AS (
  SELECT
    'topic'::text AS dimension,
    e.topic_key::text AS group_key,
    count(*)::int AS total,
    count(*) FILTER (WHERE e.effective_brukt)::int AS brukt,
    count(*) FILTER (WHERE e.status = 'ignorert')::int AS ignorert,
    count(*) FILTER (WHERE e.status = 'auto_ignorert')::int AS auto_ignorert,
    count(*) FILTER (WHERE e.status = 'blokkert')::int AS blokkert,
    round(avg(e.ai_relevance) FILTER (WHERE e.ai_relevance IS NOT NULL), 2) AS avg_ai_relevance,
    CASE
      WHEN count(*) = 0 THEN NULL::numeric
      ELSE round(
        (count(*) FILTER (WHERE e.effective_brukt)::numeric / count(*)::numeric),
        4
      )
    END AS brukt_rate
  FROM enriched e
  GROUP BY e.topic_key
  HAVING count(*) >= 5
),
by_link_domain AS (
  SELECT
    'link_domain'::text AS dimension,
    e.link_domain_key::text AS group_key,
    count(*)::int AS total,
    count(*) FILTER (WHERE e.effective_brukt)::int AS brukt,
    count(*) FILTER (WHERE e.status = 'ignorert')::int AS ignorert,
    count(*) FILTER (WHERE e.status = 'auto_ignorert')::int AS auto_ignorert,
    count(*) FILTER (WHERE e.status = 'blokkert')::int AS blokkert,
    round(avg(e.ai_relevance) FILTER (WHERE e.ai_relevance IS NOT NULL), 2) AS avg_ai_relevance,
    CASE
      WHEN count(*) = 0 THEN NULL::numeric
      ELSE round(
        (count(*) FILTER (WHERE e.effective_brukt)::numeric / count(*)::numeric),
        4
      )
    END AS brukt_rate
  FROM enriched e
  GROUP BY e.link_domain_key
  HAVING count(*) >= 5
)
SELECT * FROM by_subreddit
UNION ALL
SELECT * FROM by_topic
UNION ALL
SELECT * FROM by_link_domain;

REVOKE ALL ON TABLE public.reddit_learning_stats FROM PUBLIC;
REVOKE ALL ON TABLE public.reddit_learning_stats FROM anon, authenticated;
GRANT SELECT ON TABLE public.reddit_learning_stats TO service_role;

COMMIT;