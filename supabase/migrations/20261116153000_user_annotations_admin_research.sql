-- Research-markeringer: flag_type + admin-only RLS. Eksisterende rader beholdes (inkl. sak).
-- Manuell apply: Coolify Expert backup + dry-run før merge.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.user_annotations
  ADD COLUMN IF NOT EXISTS flag_type text NOT NULL DEFAULT 'viktig_argument';

ALTER TABLE public.user_annotations DROP CONSTRAINT IF EXISTS user_annotations_flag_type_check;
ALTER TABLE public.user_annotations ADD CONSTRAINT user_annotations_flag_type_check
  CHECK (
    flag_type IN (
      'viktig_argument',
      'faktasjekk',
      'kildesok',
      'motargument',
      'sporsmal'
    )
  );

ALTER TABLE public.user_annotations DROP CONSTRAINT IF EXISTS user_annotations_target_type_check;
ALTER TABLE public.user_annotations ADD CONSTRAINT user_annotations_target_type_check
  CHECK (target_type IN ('sak', 'research', 'research_topic'));

DROP POLICY IF EXISTS user_annotations_select_own ON public.user_annotations;
DROP POLICY IF EXISTS user_annotations_insert_own ON public.user_annotations;
DROP POLICY IF EXISTS user_annotations_update_own ON public.user_annotations;
DROP POLICY IF EXISTS user_annotations_delete_own ON public.user_annotations;

DROP POLICY IF EXISTS user_annotations_select_admin ON public.user_annotations;
CREATE POLICY user_annotations_select_admin ON public.user_annotations
  FOR SELECT
  TO authenticated
  USING (public.is_admin() AND user_id = auth.uid());

DROP POLICY IF EXISTS user_annotations_insert_admin ON public.user_annotations;
CREATE POLICY user_annotations_insert_admin ON public.user_annotations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    AND user_id = auth.uid()
    AND target_type IN ('research', 'research_topic')
  );

DROP POLICY IF EXISTS user_annotations_update_admin ON public.user_annotations;
CREATE POLICY user_annotations_update_admin ON public.user_annotations
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() AND user_id = auth.uid())
  WITH CHECK (public.is_admin() AND user_id = auth.uid());

DROP POLICY IF EXISTS user_annotations_delete_admin ON public.user_annotations;
CREATE POLICY user_annotations_delete_admin ON public.user_annotations
  FOR DELETE
  TO authenticated
  USING (public.is_admin() AND user_id = auth.uid());

REVOKE ALL ON TABLE public.user_annotations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_annotations TO authenticated;
GRANT ALL ON TABLE public.user_annotations TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';