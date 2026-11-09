-- Research tema-brief fase 3: kobling til sak og Stortinget-avstemning. Manuell apply på prod.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.research_topics
  ADD COLUMN IF NOT EXISTS stortinget_issue_id text
    REFERENCES public.stortinget_issues (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stortinget_poll_id uuid
    REFERENCES public.polls (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS research_topics_stortinget_poll_id_idx
  ON public.research_topics (stortinget_poll_id)
  WHERE stortinget_poll_id IS NOT NULL;

COMMENT ON COLUMN public.research_topics.stortinget_issue_id IS
  'Sak koblet fra tema-brief (fase 3). Ikke Reddit-tittel.';
COMMENT ON COLUMN public.research_topics.stortinget_poll_id IS
  'Aktiv eller sist publiserte Stortinget-avstemning fra tema-brief.';

COMMIT;
