-- Production readiness: AI webhook dedupe, Stortinget issue dates, forum prompt sak link

ALTER TABLE public.stortinget_issues
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_summary_requested_at timestamptz;

UPDATE public.stortinget_issues
SET first_seen_at = COALESCE(first_seen_at, last_synced_at, now()),
    last_updated_at = COALESCE(last_updated_at, last_synced_at, now())
WHERE first_seen_at IS NULL OR last_updated_at IS NULL;

ALTER TABLE public.forum_prompts
  ADD COLUMN IF NOT EXISTS stortinget_issue_id text REFERENCES public.stortinget_issues (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS stortinget_issues_pending_duration_idx
  ON public.stortinget_issues (status, first_seen_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS forum_prompts_stortinget_issue_idx
  ON public.forum_prompts (stortinget_issue_id)
  WHERE stortinget_issue_id IS NOT NULL;
