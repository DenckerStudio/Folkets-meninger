-- Forum reports: categories, admin notes, one report per user per target

ALTER TABLE public.forum_reports
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.forum_reports
  DROP CONSTRAINT IF EXISTS forum_reports_category_check;

ALTER TABLE public.forum_reports
  ADD CONSTRAINT forum_reports_category_check
  CHECK (
    category IS NULL
    OR category IN ('spam', 'harassment', 'misinformation', 'other')
  );

-- Backfill null category as other for existing rows (optional)
UPDATE public.forum_reports SET category = 'other' WHERE category IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS forum_reports_reporter_target_uidx
  ON public.forum_reports (reporter_user_id, target_type, target_id);
