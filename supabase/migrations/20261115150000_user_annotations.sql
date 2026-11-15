-- Private tekstmarkeringer og notater per sak eller research-cluster (kun egen bruker).
-- Manuell apply: Coolify Expert backup + dry-run + apply før merge.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.user_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('sak', 'research')),
  target_id text NOT NULL,
  container_key text NOT NULL,
  quote text NOT NULL,
  note text,
  start_offset integer NOT NULL,
  end_offset integer NOT NULL,
  anchor_prefix text,
  anchor_suffix text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_annotations_target_id_nonempty CHECK (char_length(btrim(target_id)) > 0),
  CONSTRAINT user_annotations_container_key_nonempty CHECK (char_length(btrim(container_key)) > 0),
  CONSTRAINT user_annotations_quote_nonempty CHECK (char_length(btrim(quote)) > 0),
  CONSTRAINT user_annotations_quote_max CHECK (char_length(quote) <= 2000),
  CONSTRAINT user_annotations_note_max CHECK (note IS NULL OR char_length(note) <= 4000),
  CONSTRAINT user_annotations_offsets_valid CHECK (
    start_offset >= 0 AND end_offset > start_offset AND end_offset - start_offset <= 2000
  )
);

CREATE INDEX IF NOT EXISTS user_annotations_user_target_idx
  ON public.user_annotations (user_id, target_type, target_id, container_key);

ALTER TABLE public.user_annotations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_annotations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_annotations TO authenticated;
GRANT ALL ON TABLE public.user_annotations TO service_role;

DROP POLICY IF EXISTS user_annotations_select_own ON public.user_annotations;
CREATE POLICY user_annotations_select_own ON public.user_annotations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_annotations_insert_own ON public.user_annotations;
CREATE POLICY user_annotations_insert_own ON public.user_annotations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_annotations_update_own ON public.user_annotations;
CREATE POLICY user_annotations_update_own ON public.user_annotations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_annotations_delete_own ON public.user_annotations;
CREATE POLICY user_annotations_delete_own ON public.user_annotations
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_user_annotations_updated_at ON public.user_annotations;
CREATE TRIGGER trg_user_annotations_updated_at
  BEFORE UPDATE ON public.user_annotations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;

NOTIFY pgrst, 'reload schema';