-- Public product feedback / “Gi innspill” submissions from marketing pages.
CREATE TABLE IF NOT EXISTS public.site_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text,
  email text NOT NULL,
  category text NOT NULL DEFAULT 'annet'
    CHECK (category IN ('idé', 'feil', 'spørsmål', 'annet')),
  message text NOT NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  user_agent text,
  page_path text
);

CREATE INDEX IF NOT EXISTS site_feedback_created_at_idx
  ON public.site_feedback (created_at DESC);

ALTER TABLE public.site_feedback ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated direct table access; API uses service role.
DROP POLICY IF EXISTS site_feedback_service ON public.site_feedback;
CREATE POLICY site_feedback_service ON public.site_feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.site_feedback TO service_role;
