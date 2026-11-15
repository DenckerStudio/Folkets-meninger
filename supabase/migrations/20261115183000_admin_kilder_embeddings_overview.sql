-- Admin read-only overviews: kilder (RAG + oppfanget) og embedding-dekning.
-- Coolify Expert: backup + dry-run før manuell apply.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.admin_get_kilde_overview(p_admin_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_actor uuid;
  v_rag jsonb;
  v_capture jsonb;
  v_last_chunk timestamptz;
  v_last_issue_doc timestamptz;
  v_last_hearing_doc timestamptz;
BEGIN
  v_actor := public.require_admin_user_id(p_admin_user_id);

  SELECT max(dc.created_at)
  INTO v_last_chunk
  FROM public.document_chunks dc;

  SELECT max(d.fetched_at)
  INTO v_last_issue_doc
  FROM public.stortinget_issue_documents d;

  SELECT max(hd.updated_at)
  INTO v_last_hearing_doc
  FROM public.hearing_documents hd;

  WITH chunk_rows AS (
    SELECT
      dc.created_at,
      CASE
        WHEN dc.hearing_document_id IS NOT NULL THEN 'høring'
        ELSE coalesce(
          nullif(btrim(d.document_type), ''),
          nullif(btrim(dc.metadata->>'document_kind'), ''),
          'ukjent'
        )
      END AS source_type,
      CASE
        WHEN dc.hearing_document_id IS NOT NULL THEN 'høring'
        ELSE 'stortinget_sak'
      END AS corpus,
      dc.issue_id,
      dc.document_id,
      dc.hearing_document_id
    FROM public.document_chunks dc
    LEFT JOIN public.stortinget_issue_documents d
      ON d.issue_id = dc.issue_id
      AND d.document_id = dc.document_id
  ),
  grouped AS (
    SELECT
      cr.source_type,
      cr.corpus,
      count(*)::int AS chunk_count,
      count(DISTINCT CASE
        WHEN cr.hearing_document_id IS NOT NULL THEN cr.hearing_document_id::text
        ELSE cr.issue_id || ':' || cr.document_id
      END)::int AS document_count,
      count(*) FILTER (WHERE cr.created_at >= now() - interval '7 days')::int AS chunks_7d,
      count(*) FILTER (WHERE cr.created_at >= now() - interval '30 days')::int AS chunks_30d,
      count(*) FILTER (WHERE cr.created_at >= now() - interval '90 days')::int AS chunks_90d,
      max(cr.created_at) AS last_chunk_at
    FROM chunk_rows cr
    GROUP BY cr.source_type, cr.corpus
  )
  SELECT coalesce(jsonb_agg(row_to_json(g)::jsonb ORDER BY g.chunk_count DESC), '[]'::jsonb)
  INTO v_rag
  FROM grouped g;

  SELECT coalesce(
    jsonb_agg(row_to_json(s)::jsonb ORDER BY s.source_count DESC),
    '[]'::jsonb
  )
  INTO v_capture
  FROM (
    SELECT
      coalesce(nullif(btrim(src.source_type), ''), 'ukjent') AS source_type,
      count(*)::int AS source_count,
      count(*) FILTER (WHERE src.fetched_at >= now() - interval '7 days')::int AS sources_7d,
      count(*) FILTER (WHERE src.fetched_at >= now() - interval '30 days')::int AS sources_30d,
      count(*) FILTER (WHERE src.fetched_at >= now() - interval '90 days')::int AS sources_90d,
      max(src.fetched_at) AS last_fetched_at
    FROM public.action_sources src
    GROUP BY coalesce(nullif(btrim(src.source_type), ''), 'ukjent')
  ) s;

  RETURN jsonb_build_object(
    'generatedAt', now(),
    'lastChunkAt', v_last_chunk,
    'lastIssueDocumentFetchAt', v_last_issue_doc,
    'lastHearingDocumentUpdateAt', v_last_hearing_doc,
    'ragBySourceType', v_rag,
    'captureBySourceType', v_capture
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_embedding_coverage(p_admin_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_actor uuid;
  v_legacy_ready int := 0;
  v_legacy_pending int := 0;
  v_legacy_failed int := 0;
  v_v2_ready int := 0;
  v_v2_pending int := 0;
  v_v2_failed int := 0;
  v_v2_missing int := 0;
  v_models jsonb;
  v_total_issues int := 0;
  v_issues_with_chunks int := 0;
  v_last_v2_at timestamptz;
  v_last_legacy_at timestamptz;
  v_backlog jsonb;
BEGIN
  v_actor := public.require_admin_user_id(p_admin_user_id);

  SELECT
    count(*) FILTER (WHERE embedding_status = 'ready' AND embedding IS NOT NULL)::int,
    count(*) FILTER (WHERE embedding_status = 'pending')::int,
    count(*) FILTER (WHERE embedding_status = 'failed')::int
  INTO v_legacy_ready, v_legacy_pending, v_legacy_failed
  FROM public.document_chunks;

  SELECT
    count(*) FILTER (WHERE embedding_v2 IS NOT NULL)::int,
    count(*) FILTER (WHERE embedding_v2 IS NULL AND embedding_v2_status = 'pending')::int,
    count(*) FILTER (WHERE embedding_v2_status = 'failed')::int,
    count(*) FILTER (WHERE embedding_v2 IS NULL)::int
  INTO v_v2_ready, v_v2_pending, v_v2_failed, v_v2_missing
  FROM public.document_chunks;

  SELECT coalesce(
    jsonb_agg(row_to_json(m)::jsonb ORDER BY m.chunk_count DESC),
    '[]'::jsonb
  )
  INTO v_models
  FROM (
    SELECT
      coalesce(nullif(btrim(embedding_v2_model), ''), 'ukjent') AS model_tag,
      count(*)::int AS chunk_count
    FROM public.document_chunks
    WHERE embedding_v2 IS NOT NULL
    GROUP BY coalesce(nullif(btrim(embedding_v2_model), ''), 'ukjent')
  ) m;

  SELECT count(*)::int INTO v_total_issues FROM public.stortinget_issues;

  SELECT count(DISTINCT issue_id)::int
  INTO v_issues_with_chunks
  FROM public.document_chunks
  WHERE issue_id IS NOT NULL;

  SELECT max(embedding_v2_at) INTO v_last_v2_at FROM public.document_chunks;

  SELECT max(created_at)
  INTO v_last_legacy_at
  FROM public.document_chunks
  WHERE embedding_status = 'ready' AND embedding IS NOT NULL;

  v_backlog := public.n8n_embedding_backlog_health();

  RETURN jsonb_build_object(
    'generatedAt', now(),
    'legacy', jsonb_build_object(
      'dimension', 768,
      'modelTag', 'nomic-embed-text',
      'ready', v_legacy_ready,
      'pending', v_legacy_pending,
      'failed', v_legacy_failed,
      'lastReadyAt', v_last_legacy_at
    ),
    'v2', jsonb_build_object(
      'dimension', 1024,
      'ready', v_v2_ready,
      'pending', v_v2_pending,
      'failed', v_v2_failed,
      'missingVector', v_v2_missing,
      'models', v_models,
      'lastRunAt', v_last_v2_at
    ),
    'issues', jsonb_build_object(
      'total', v_total_issues,
      'withChunks', v_issues_with_chunks,
      'withoutChunks', greatest(v_total_issues - v_issues_with_chunks, 0),
      'shareWithoutChunks', CASE
        WHEN v_total_issues > 0 THEN round((greatest(v_total_issues - v_issues_with_chunks, 0)::numeric / v_total_issues::numeric), 4)
        ELSE 0
      END
    ),
    'backlogHealth', v_backlog
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_kilde_overview(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_get_embedding_coverage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_kilde_overview(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_embedding_coverage(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;