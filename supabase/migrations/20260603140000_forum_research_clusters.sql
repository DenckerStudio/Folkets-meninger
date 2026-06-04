-- Forum Reels v7: two-step pipeline (discovery → deep synthesis)
-- Flow 1 stores interesting story clusters; flow 2 deep-researches and creates prompts.

CREATE TABLE IF NOT EXISTS public.forum_research_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_cluster_key text,
  title text NOT NULL,
  discovery_rationale text,
  topic_tags text[] NOT NULL DEFAULT '{}',
  politics_score int NOT NULL DEFAULT 0,
  source_count int NOT NULL DEFAULT 0,
  span_days numeric,
  stortinget_issue_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'failed')),
  deep_research_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.forum_research_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.forum_research_clusters (id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  outlet text,
  published_at timestamptz,
  description text,
  image_url text,
  video_url text,
  article_text text,
  article_fetch_status text,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cluster_id, url)
);

CREATE INDEX IF NOT EXISTS forum_research_clusters_status_idx
  ON public.forum_research_clusters (status, politics_score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS forum_research_clusters_title_recent_idx
  ON public.forum_research_clusters (lower(trim(title)), created_at DESC);

CREATE INDEX IF NOT EXISTS forum_research_articles_cluster_idx
  ON public.forum_research_articles (cluster_id, sort_order);

ALTER TABLE public.forum_research_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_research_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forum_research_clusters_select ON public.forum_research_clusters;
CREATE POLICY forum_research_clusters_select ON public.forum_research_clusters
  FOR SELECT USING (true);

DROP POLICY IF EXISTS forum_research_articles_select ON public.forum_research_articles;
CREATE POLICY forum_research_articles_select ON public.forum_research_articles
  FOR SELECT USING (true);

COMMENT ON TABLE public.forum_research_clusters IS 'Story clusters queued by forum-research-discovery for deep synthesis';
COMMENT ON TABLE public.forum_research_articles IS 'Source articles per research cluster';
