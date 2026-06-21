-- Forum Reels v9: two-step human review (clusters → synthesis → draft prompts)

-- Extend cluster status lifecycle for editor approval before synthesis
ALTER TABLE public.forum_research_clusters
  DROP CONSTRAINT IF EXISTS forum_research_clusters_status_check;

-- Normalize all known statuses (v7 + v10.2 ahead-of-migration) before re-adding constraint
UPDATE public.forum_research_clusters
SET status = CASE status
  WHEN 'pending' THEN 'pending_review'
  WHEN 'accepted' THEN 'approved'
  WHEN 'draft' THEN 'completed'
  WHEN 'finished' THEN 'completed'
  ELSE status
END,
updated_at = now()
WHERE status IN ('pending', 'accepted', 'draft', 'finished');

-- Fallback for any unexpected legacy value
UPDATE public.forum_research_clusters
SET status = 'pending_review', updated_at = now()
WHERE status NOT IN (
  'pending_review',
  'approved',
  'rejected',
  'processing',
  'completed',
  'failed'
);

ALTER TABLE public.forum_research_clusters
  ALTER COLUMN status SET DEFAULT 'pending_review';

ALTER TABLE public.forum_research_clusters
  ADD CONSTRAINT forum_research_clusters_status_check
  CHECK (
    status IN (
      'pending_review',
      'approved',
      'rejected',
      'processing',
      'completed',
      'failed'
    )
  );

COMMENT ON COLUMN public.forum_research_clusters.status IS
  'pending_review=awaiting editor; approved=queued; processing=synthesis running; completed=prompt drafted; rejected/failed=terminal';

-- Optional trace from generated prompt back to cluster (n8n may set on insert later)
ALTER TABLE public.forum_prompts
  ADD COLUMN IF NOT EXISTS research_cluster_id uuid
  REFERENCES public.forum_research_clusters (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS forum_prompts_research_cluster_idx
  ON public.forum_prompts (research_cluster_id)
  WHERE research_cluster_id IS NOT NULL;
