-- Forum Reels v10.2: DB-backed synthesis queue (no webhook on approve)
-- Status lifecycle: pending → accepted → processing → draft → finished | rejected | failed

ALTER TABLE public.forum_research_clusters
  DROP CONSTRAINT IF EXISTS forum_research_clusters_status_check;

-- Recover stuck synthesis jobs
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

-- Fallback before v10.2 constraint (e.g. partial v9 apply or manual edits)
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

COMMENT ON COLUMN public.forum_research_clusters.status IS
  'pending=scout queue; accepted=synthesis queue; processing=n8n worker; draft=prompt created; finished=published; rejected/failed=terminal';

-- Drop unused cluster columns (never populated by v10 scout)
ALTER TABLE public.forum_research_clusters
  DROP COLUMN IF EXISTS span_days,
  DROP COLUMN IF EXISTS stortinget_issue_id;

-- Drop unused article enrichment columns (v10 scout stores title/url/outlet/description only)
ALTER TABLE public.forum_research_articles
  DROP COLUMN IF EXISTS article_text,
  DROP COLUMN IF EXISTS article_fetch_status,
  DROP COLUMN IF EXISTS image_url,
  DROP COLUMN IF EXISTS video_url;

-- Fast dequeue for n8n schedule worker
CREATE INDEX IF NOT EXISTS forum_research_clusters_accepted_queue_idx
  ON public.forum_research_clusters (politics_score DESC, created_at ASC)
  WHERE status = 'accepted';
