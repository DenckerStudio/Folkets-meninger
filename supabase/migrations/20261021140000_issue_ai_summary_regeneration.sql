-- Flag for admin-avvist sammendrag: n8n backfill (GP666Zq84qc19tcE) regenererer via n8n_list_issues_missing_ai_summary.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.issue_ai_summaries
  ADD COLUMN IF NOT EXISTS regeneration_requested_at timestamptz;

COMMENT ON COLUMN public.issue_ai_summaries.regeneration_requested_at IS
  'Satt av fm-web ved content_feedback reject (ai_summary); tømmes ved godkjenning.';

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
     OR s.regeneration_requested_at IS NOT NULL
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
    CASE WHEN s.regeneration_requested_at IS NOT NULL THEN 0 ELSE 1 END,
    CASE WHEN s.stortinget_issue_id IS NULL THEN 0 ELSE 1 END,
    i.last_synced_at DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(p_limit, 1), 50));
$$;

REVOKE ALL ON FUNCTION public.n8n_list_issues_missing_ai_summary(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_list_issues_missing_ai_summary(int) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
