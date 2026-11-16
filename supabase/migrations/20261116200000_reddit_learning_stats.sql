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

CREATE OR REPLACE VIEW public.reddit_cluster_stats
WITH (security_invoker = true) AS
WITH signals AS (
  SELECT rs.*
  FROM public.reddit_signals rs
  WHERE rs.cluster_id IS NOT NULL
    AND btrim(rs.cluster_id) <> ''
),
per_signal AS (
  SELECT
    s.id,
    s.cluster_id,
    s.subreddit,
    s.topic,
    s.title,
    s.url,
    s.score,
    s.num_comments,
    s.num_crossposts,
    s.status,
    s.last_seen_at,
    (
      s.score + 2 * s.num_comments + 5 * COALESCE(s.num_crossposts, 0)
    ) AS engagement,
    CASE
      WHEN base.signal_id IS NULL THEN NULL
      ELSE (
        s.score + 2 * s.num_comments + 5 * COALESCE(s.num_crossposts, 0)
      ) - (
        base.score + 2 * base.num_comments + 5 * COALESCE(base.num_crossposts, 0)
      )
    END AS growth_24h
  FROM signals s
  LEFT JOIN LATERAL (
    SELECT
      rss.signal_id,
      rss.score,
      rss.num_comments,
      rss.num_crossposts
    FROM public.reddit_signal_snapshots rss
    WHERE rss.signal_id = s.id
      AND rss.captured_at <= (now() - interval '24 hours')
    ORDER BY rss.captured_at DESC
    LIMIT 1
  ) base ON true
),
top_posts AS (
  SELECT DISTINCT ON (ps.cluster_id)
    ps.cluster_id,
    ps.id AS top_post_id,
    ps.title AS top_post_title,
    ps.url AS top_post_url,
    ps.score AS top_post_score,
    ps.num_comments AS top_post_num_comments,
    ps.subreddit AS top_post_subreddit
  FROM per_signal ps
  ORDER BY ps.cluster_id, ps.engagement DESC, ps.last_seen_at DESC
),
cluster_agg AS (
  SELECT
    ps.cluster_id,
    count(*)::int AS post_count,
    sum(ps.score)::int AS sum_score,
    sum(ps.num_comments)::int AS sum_comments,
    CASE
      WHEN count(ps.growth_24h) FILTER (WHERE ps.growth_24h IS NOT NULL) = 0 THEN NULL::int
      ELSE round(sum(ps.growth_24h) FILTER (WHERE ps.growth_24h IS NOT NULL))::int
    END AS growth_24h,
    max(ps.last_seen_at) AS last_seen_at,
    count(*) FILTER (WHERE ps.status = 'ny')::int AS status_ny,
    count(*) FILTER (WHERE ps.status = 'brukt')::int AS status_brukt,
    count(*) FILTER (WHERE ps.status = 'ignorert')::int AS status_ignorert,
    count(*) FILTER (WHERE ps.status = 'auto_ignorert')::int AS status_auto_ignorert,
    count(*) FILTER (WHERE ps.status = 'blokkert')::int AS status_blokkert,
    COALESCE(
      array_agg(DISTINCT btrim(ps.topic)) FILTER (
        WHERE ps.topic IS NOT NULL AND btrim(ps.topic) <> ''
      ),
      ARRAY[]::text[]
    ) AS topics,
    COALESCE(array_agg(DISTINCT ps.subreddit::text), ARRAY[]::text[]) AS subreddits
  FROM per_signal ps
  GROUP BY ps.cluster_id
)
SELECT
  ca.cluster_id,
  ca.post_count,
  ca.sum_score,
  ca.sum_comments,
  ca.growth_24h,
  ca.last_seen_at,
  ca.status_ny,
  ca.status_brukt,
  ca.status_ignorert,
  ca.status_auto_ignorert,
  ca.status_blokkert,
  ca.topics,
  ca.subreddits,
  tp.top_post_id,
  tp.top_post_title,
  tp.top_post_url,
  tp.top_post_score,
  tp.top_post_num_comments,
  tp.top_post_subreddit
FROM cluster_agg ca
LEFT JOIN top_posts tp ON tp.cluster_id = ca.cluster_id;

CREATE OR REPLACE VIEW public.reddit_cluster_meta
WITH (security_invoker = true) AS
SELECT
  (
    SELECT count(DISTINCT btrim(rs.cluster_id))::int
    FROM public.reddit_signals rs
    WHERE rs.cluster_id IS NOT NULL AND btrim(rs.cluster_id) <> ''
  ) AS total_clusters,
  (
    SELECT count(*)::int
    FROM public.reddit_signals rs
    WHERE rs.cluster_id IS NULL OR btrim(rs.cluster_id) = ''
  ) AS unclustered_signals;

REVOKE ALL ON TABLE public.reddit_cluster_stats FROM PUBLIC;
REVOKE ALL ON TABLE public.reddit_cluster_stats FROM anon, authenticated;
GRANT SELECT ON TABLE public.reddit_cluster_stats TO service_role;

REVOKE ALL ON TABLE public.reddit_cluster_meta FROM PUBLIC;
REVOKE ALL ON TABLE public.reddit_cluster_meta FROM anon, authenticated;
GRANT SELECT ON TABLE public.reddit_cluster_meta TO service_role;

COMMIT;