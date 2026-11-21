-- Forslag til «Om Folkets Meninger»-innlegg, kun admin.
-- Tabell-DDL kjøres som postgres (migrasjonseier). Manuell apply. Ikke kjør mot prod herfra.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.about_blog_suggestions (
  suggestion_key text PRIMARY KEY CHECK (suggestion_key ~ '^[a-z0-9:_-]{3,160}$'),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 110),
  angle text NOT NULL DEFAULT '' CHECK (char_length(angle) <= 600),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 400),
  source text NOT NULL CHECK (
    source IN ('dekning', 'endringslogg', 'veikart', 'research', 'nett', 'staende')
  ),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'used', 'dismissed', 'snoozed')),
  related_title text CHECK (related_title IS NULL OR char_length(related_title) <= 200),
  related_kind text CHECK (related_kind IS NULL OR related_kind IN ('utkast', 'publisert')),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_request_id uuid,
  source_event text CHECK (source_event IS NULL OR char_length(source_event) <= 200),
  snooze_until timestamptz,
  acted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS about_blog_suggestions_status_updated_idx
  ON public.about_blog_suggestions (status, updated_at DESC);

DROP TRIGGER IF EXISTS trg_about_blog_suggestions_updated_at ON public.about_blog_suggestions;
CREATE TRIGGER trg_about_blog_suggestions_updated_at
  BEFORE UPDATE ON public.about_blog_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.about_blog_suggestions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.about_blog_suggestions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.about_blog_suggestions TO authenticated;
GRANT ALL ON TABLE public.about_blog_suggestions TO service_role;

DROP POLICY IF EXISTS about_blog_suggestions_admin_select ON public.about_blog_suggestions;
CREATE POLICY about_blog_suggestions_admin_select ON public.about_blog_suggestions
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS about_blog_suggestions_admin_insert ON public.about_blog_suggestions;
CREATE POLICY about_blog_suggestions_admin_insert ON public.about_blog_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS about_blog_suggestions_admin_update ON public.about_blog_suggestions;
CREATE POLICY about_blog_suggestions_admin_update ON public.about_blog_suggestions
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS about_blog_suggestions_admin_delete ON public.about_blog_suggestions;
CREATE POLICY about_blog_suggestions_admin_delete ON public.about_blog_suggestions
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

COMMIT;

NOTIFY pgrst, 'reload schema';
