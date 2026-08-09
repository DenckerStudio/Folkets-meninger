-- Dedupe forum_prompts: archive duplicate active reels, add partial unique index

WITH ranked AS (
  SELECT
    id,
    lower(trim(question)) AS qnorm,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(question))
      ORDER BY created_at ASC, sort_order ASC
    ) AS rn
  FROM public.forum_prompts
  WHERE status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
    AND trim(question) <> ''
)
UPDATE public.forum_prompts fp
SET status = 'archived'
FROM ranked r
WHERE fp.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS forum_prompts_active_question_unique
  ON public.forum_prompts (lower(trim(question)))
  WHERE status = 'active'
    AND trim(question) <> '';
