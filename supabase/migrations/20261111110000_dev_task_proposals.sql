-- Admin-kanban for auto-genererte dev-oppgaveforslag (kun forslag, ingen auto-koding).
-- Manuell apply på prod etter Mathias sitt ja.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.dev_task_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  source text NOT NULL,
  signal_ref text,
  dedupe_key text NOT NULL UNIQUE,
  risk text NOT NULL DEFAULT 'normal' CHECK (risk IN ('low', 'normal')),
  status text NOT NULL DEFAULT 'til_godkjenning' CHECK (
    status IN ('til_godkjenning', 'i_prosess', 'ferdig', 'avslatt')
  ),
  decided_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  decided_at timestamptz,
  pr_url text,
  slack_ts text,
  slack_posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dev_task_proposals_status_created_idx
  ON public.dev_task_proposals (status, created_at DESC);

CREATE INDEX IF NOT EXISTS dev_task_proposals_status_slack_posted_idx
  ON public.dev_task_proposals (status, slack_posted_at);

DROP TRIGGER IF EXISTS trg_dev_task_proposals_updated_at ON public.dev_task_proposals;
CREATE TRIGGER trg_dev_task_proposals_updated_at
  BEFORE UPDATE ON public.dev_task_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.dev_task_proposals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.dev_task_proposals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dev_task_proposals TO authenticated;
GRANT ALL ON TABLE public.dev_task_proposals TO service_role;

DROP POLICY IF EXISTS dev_task_proposals_admin_select ON public.dev_task_proposals;
CREATE POLICY dev_task_proposals_admin_select ON public.dev_task_proposals
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS dev_task_proposals_admin_insert ON public.dev_task_proposals;
CREATE POLICY dev_task_proposals_admin_insert ON public.dev_task_proposals
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS dev_task_proposals_admin_update ON public.dev_task_proposals;
CREATE POLICY dev_task_proposals_admin_update ON public.dev_task_proposals
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS dev_task_proposals_admin_delete ON public.dev_task_proposals;
CREATE POLICY dev_task_proposals_admin_delete ON public.dev_task_proposals
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

COMMIT;

NOTIFY pgrst, 'reload schema';
