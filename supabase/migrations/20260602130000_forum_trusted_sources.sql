-- Approved news domains for forum reels (n8n + admin)
CREATE TABLE IF NOT EXISTS public.forum_trusted_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  outlet_label text NOT NULL,
  status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('approved', 'pending', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users (id)
);

CREATE INDEX IF NOT EXISTS forum_trusted_sources_status_idx
  ON public.forum_trusted_sources (status);

ALTER TABLE public.forum_trusted_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forum_trusted_sources_select ON public.forum_trusted_sources;
CREATE POLICY forum_trusted_sources_select ON public.forum_trusted_sources
  FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.forum_trusted_sources (domain, outlet_label, status, approved_at)
VALUES
  ('vg.no', 'VG', 'approved', now()),
  ('nrk.no', 'NRK', 'approved', now()),
  ('aftenposten.no', 'Aftenposten', 'approved', now()),
  ('dagbladet.no', 'Dagbladet', 'approved', now()),
  ('stortinget.no', 'Stortinget', 'approved', now()),
  ('folketsstemme.no', 'Folkets Stemme', 'approved', now()),
  ('folkets-stemme.no', 'Folkets Stemme', 'approved', now())
ON CONFLICT (domain) DO NOTHING;
