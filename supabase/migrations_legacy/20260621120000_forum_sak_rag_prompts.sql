-- Forum Reels v13: Stortinget-sak RAG prompts + cluster source types

ALTER TABLE public.forum_research_clusters
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'rss';

ALTER TABLE public.forum_research_clusters
  DROP CONSTRAINT IF EXISTS forum_research_clusters_source_type_check;

ALTER TABLE public.forum_research_clusters
  ADD CONSTRAINT forum_research_clusters_source_type_check
  CHECK (source_type IN ('rss', 'stortinget_sak', 'votering', 'user_submission'));

ALTER TABLE public.forum_prompts
  ADD COLUMN IF NOT EXISTS generation_metadata jsonb;

CREATE INDEX IF NOT EXISTS forum_research_clusters_source_type_idx
  ON public.forum_research_clusters (source_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS forum_prompts_generation_source_idx
  ON public.forum_prompts (stortinget_issue_id, status)
  WHERE stortinget_issue_id IS NOT NULL;

COMMENT ON COLUMN public.forum_research_clusters.source_type IS
  'rss | stortinget_sak | votering | user_submission — how the cluster was discovered';

COMMENT ON COLUMN public.forum_prompts.generation_metadata IS
  'Optional RAG / pipeline metadata (chunks used, confidence, source_type)';

CREATE OR REPLACE FUNCTION public.get_sak_prompt_coverage()
RETURNS TABLE (
  pending_issues bigint,
  pending_with_rag bigint,
  pending_with_prompt bigint,
  sak_candidates bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*) FILTER (WHERE i.status = 'pending') AS pending_issues,
    COUNT(*) FILTER (
      WHERE i.status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM public.document_chunks dc
          WHERE dc.issue_id = i.id
            AND dc.embedding_status = 'ready'
        )
    ) AS pending_with_rag,
    COUNT(*) FILTER (
      WHERE i.status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM public.forum_prompts fp
          WHERE fp.stortinget_issue_id = i.id
            AND fp.status IN ('active', 'draft')
        )
    ) AS pending_with_prompt,
    COUNT(*) FILTER (
      WHERE i.status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM public.document_chunks dc
          WHERE dc.issue_id = i.id
            AND dc.embedding_status = 'ready'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.forum_prompts fp
          WHERE fp.stortinget_issue_id = i.id
            AND fp.status IN ('active', 'draft')
        )
    ) AS sak_candidates
  FROM public.stortinget_issues i;
$$;
