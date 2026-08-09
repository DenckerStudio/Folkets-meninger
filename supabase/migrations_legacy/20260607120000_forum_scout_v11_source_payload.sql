-- Forum Reels scout v11: rich article metadata + scout debug metadata on clusters

ALTER TABLE public.forum_research_articles
  ADD COLUMN IF NOT EXISTS source_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.forum_research_articles.source_payload IS
  'Scout enrichment: excerpt, fetch_status, image_url, word_count, published_at_rss';

ALTER TABLE public.forum_research_clusters
  ADD COLUMN IF NOT EXISTS scout_metadata jsonb DEFAULT NULL;

COMMENT ON COLUMN public.forum_research_clusters.scout_metadata IS
  'Scout v11: outlet_count, cluster_score, ingest stats, debatten_used';

COMMENT ON COLUMN public.forum_research_clusters.politics_score IS
  'Deterministic politics priority from scout ingest (higher = dequeue first)';
