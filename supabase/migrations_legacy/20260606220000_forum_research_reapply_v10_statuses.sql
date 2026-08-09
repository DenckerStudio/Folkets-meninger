-- Re-apply v10.2 cluster statuses after accidental v9 rollback (20260606201733)

ALTER TABLE public.forum_research_clusters
  DROP CONSTRAINT IF EXISTS forum_research_clusters_status_check;

UPDATE public.forum_research_clusters
SET status = 'accepted', updated_at = now()
WHERE status = 'processing'
  AND deep_research_json IS NULL
  AND updated_at < now() - interval '90 minutes';

UPDATE public.forum_research_clusters
SET status = CASE status
  WHEN 'pending_review' THEN 'pending'
  WHEN 'approved' THEN 'accepted'
  WHEN 'completed' THEN 'draft'
  ELSE status
END,
updated_at = now()
WHERE status IN ('pending_review', 'approved', 'completed');

UPDATE public.forum_research_clusters
SET status = 'pending', updated_at = now()
WHERE status NOT IN (
  'pending',
  'accepted',
  'processing',
  'draft',
  'finished',
  'rejected',
  'failed'
);

ALTER TABLE public.forum_research_clusters
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.forum_research_clusters
  ADD CONSTRAINT forum_research_clusters_status_check
  CHECK (
    status IN (
      'pending',
      'accepted',
      'processing',
      'draft',
      'finished',
      'rejected',
      'failed'
    )
  );

CREATE INDEX IF NOT EXISTS forum_research_clusters_accepted_queue_idx
  ON public.forum_research_clusters (politics_score DESC, created_at ASC)
  WHERE status = 'accepted';
