-- AI summaries v2: narrative, who/how affected, dynamic topic cards, labels

ALTER TABLE public.issue_ai_summaries
  ADD COLUMN IF NOT EXISTS narrative text,
  ADD COLUMN IF NOT EXISTS who_affected text,
  ADD COLUMN IF NOT EXISTS how_affected text,
  ADD COLUMN IF NOT EXISTS topic_cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS labels text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.stortinget_issues
  ADD COLUMN IF NOT EXISTS ai_labels text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS issue_ai_summaries_labels_gin
  ON public.issue_ai_summaries USING gin (labels);

CREATE INDEX IF NOT EXISTS stortinget_issues_ai_labels_gin
  ON public.stortinget_issues USING gin (ai_labels);

-- Backfill v2 from legacy hva/hvem/kostnad where possible
UPDATE public.issue_ai_summaries
SET
  narrative = COALESCE(NULLIF(trim(narrative), ''), trim(hva)),
  who_affected = COALESCE(NULLIF(trim(who_affected), ''), trim(hvem)),
  how_affected = COALESCE(
    NULLIF(trim(how_affected), ''),
    CASE WHEN trim(hvem) <> '' THEN 'Se hvem som berøres ovenfor.' ELSE NULL END
  ),
  topic_cards = CASE
    WHEN topic_cards IS NULL OR topic_cards = '[]'::jsonb THEN
      CASE
        WHEN trim(kostnad) <> '' THEN jsonb_build_array(jsonb_build_object('title', 'Økonomi', 'body', trim(kostnad)))
        ELSE '[]'::jsonb
      END
    ELSE topic_cards
  END
WHERE trim(COALESCE(hva, '')) <> '';

UPDATE public.stortinget_issues i
SET ai_labels = s.labels
FROM public.issue_ai_summaries s
WHERE s.stortinget_issue_id = i.id
  AND cardinality(s.labels) > 0
  AND (i.ai_labels IS NULL OR i.ai_labels = '{}');

COMMENT ON COLUMN public.issue_ai_summaries.labels IS
  '2–5 AI-generated topic labels for search and notifications';
COMMENT ON COLUMN public.issue_ai_summaries.topic_cards IS
  '0–3 dynamic topic cards chosen by AI (title + body)';
COMMENT ON COLUMN public.stortinget_issues.ai_labels IS
  'Denormalized copy of issue_ai_summaries.labels for fast Utforsk filter';

-- Label notification subscriptions (AI emne-tags)
CREATE TABLE IF NOT EXISTS public.notification_label_subscriptions (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, label)
);

ALTER TABLE public.notification_label_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_label_subscriptions_select_own ON public.notification_label_subscriptions;
CREATE POLICY notification_label_subscriptions_select_own
  ON public.notification_label_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_label_subscriptions_insert_own ON public.notification_label_subscriptions;
CREATE POLICY notification_label_subscriptions_insert_own
  ON public.notification_label_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_label_subscriptions_delete_own ON public.notification_label_subscriptions;
CREATE POLICY notification_label_subscriptions_delete_own
  ON public.notification_label_subscriptions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
