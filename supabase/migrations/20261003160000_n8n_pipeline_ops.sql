-- Pipeline ops for n8n: health snapshot, thin-summary refresh queue, ops event log.

CREATE TABLE IF NOT EXISTS public.n8n_ops_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('error', 'hearing', 'health', 'info')),
  subject text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS n8n_ops_events_created_at_idx
  ON public.n8n_ops_events (created_at DESC);

CREATE INDEX IF NOT EXISTS n8n_ops_events_kind_idx
  ON public.n8n_ops_events (kind, created_at DESC);

ALTER TABLE public.n8n_ops_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS n8n_ops_events_admin_read ON public.n8n_ops_events;
CREATE POLICY n8n_ops_events_admin_read ON public.n8n_ops_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.n8n_log_ops_event(
  p_kind text,
  p_subject text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text := lower(btrim(coalesce(p_kind, 'info')));
  v_id uuid;
BEGIN
  IF v_kind NOT IN ('error', 'hearing', 'health', 'info') THEN
    v_kind := 'info';
  END IF;

  INSERT INTO public.n8n_ops_events (kind, subject, payload)
  VALUES (v_kind, nullif(btrim(coalesce(p_subject, '')), ''), coalesce(p_payload, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_pipeline_health()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pending_chunks', (
      SELECT count(*)::int
      FROM public.document_chunks
      WHERE embedding_status = 'pending'
    ),
    'missing_summaries', (
      SELECT count(*)::int
      FROM public.stortinget_issues i
      LEFT JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id
      WHERE s.stortinget_issue_id IS NULL
    ),
    'thin_summaries', (
      SELECT count(*)::int
      FROM public.issue_ai_summaries s
      WHERE length(trim(coalesce(s.hva, ''))) < 180
        AND EXISTS (
          SELECT 1
          FROM public.document_chunks dc
          WHERE dc.issue_id = s.stortinget_issue_id
            AND dc.embedding_status = 'ready'
        )
    ),
    'draft_polls', (
      SELECT count(*)::int
      FROM public.polls
      WHERE track = 'system'
        AND status = 'draft'
    ),
    'recent_ops_events', (
      SELECT count(*)::int
      FROM public.n8n_ops_events
      WHERE created_at > now() - interval '24 hours'
    )
  );
$$;

DROP FUNCTION IF EXISTS public.n8n_list_issues_missing_ai_summary(int);

CREATE OR REPLACE FUNCTION public.n8n_list_issues_missing_ai_summary(p_limit int DEFAULT 1)
RETURNS TABLE (
  id text,
  title text,
  summary text,
  henvisning text,
  last_synced_at timestamptz,
  detail_json jsonb,
  ai_summary_source_context text,
  documents json,
  document_chunks json
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ctx.id,
    ctx.title,
    ctx.summary,
    ctx.henvisning,
    ctx.last_synced_at,
    ctx.detail_json,
    ctx.ai_summary_source_context,
    ctx.documents,
    ctx.document_chunks
  FROM public.stortinget_issues i
  LEFT JOIN public.issue_ai_summaries s ON s.stortinget_issue_id = i.id
  JOIN LATERAL public.n8n_get_issue_ai_summary_context(i.id) ctx ON true
  WHERE s.stortinget_issue_id IS NULL
     OR (
       length(trim(coalesce(s.hva, ''))) < 180
       AND s.updated_at < now() - interval '12 hours'
       AND EXISTS (
         SELECT 1
         FROM public.document_chunks dc
         WHERE dc.issue_id = i.id
           AND dc.embedding_status = 'ready'
       )
     )
  ORDER BY
    CASE WHEN s.stortinget_issue_id IS NULL THEN 0 ELSE 1 END,
    i.last_synced_at DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 1), 50));
$$;

REVOKE ALL ON FUNCTION public.n8n_log_ops_event(text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_pipeline_health() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.n8n_list_issues_missing_ai_summary(int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.n8n_log_ops_event(text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_pipeline_health() TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_list_issues_missing_ai_summary(int) TO service_role;
GRANT SELECT ON public.n8n_ops_events TO service_role;
GRANT INSERT ON public.n8n_ops_events TO service_role;

NOTIFY pgrst, 'reload schema';
