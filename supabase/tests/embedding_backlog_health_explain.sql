-- CI: n8n_embedding_backlog_health must not call fm_embedding_v2_issue_tier (perf at ~380k rows).
DO $$
DECLARE
  v_def text;
  v_health jsonb;
BEGIN
  IF to_regprocedure('public.n8n_embedding_backlog_health()') IS NULL THEN
    RAISE NOTICE 'embedding_backlog_health_explain.sql: hopper over';
    RETURN;
  END IF;

  SELECT pg_get_functiondef('public.n8n_embedding_backlog_health()'::regprocedure) INTO v_def;
  IF v_def ILIKE '%fm_embedding_v2_issue_tier%' THEN
    RAISE EXCEPTION 'n8n_embedding_backlog_health skal ikke kalle fm_embedding_v2_issue_tier';
  END IF;

  INSERT INTO public.stortinget_issues (id, title, last_synced_at, ferdigbehandlet, detail_json)
  VALUES ('explain-tier0', 'Tier0', now(), false, '{}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET last_synced_at = now();

  INSERT INTO public.document_chunks (
    issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status
  )
  SELECT
    'explain-tier0',
    'doc-' || g,
    g,
    'tekst ' || g,
    'pending',
    'pending'
  FROM generate_series(0, 5) g
  ON CONFLICT DO NOTHING;

  v_health := public.n8n_embedding_backlog_health();
  IF NOT (v_health ? 'pending_v2_total_is_estimate') THEN
    RAISE EXCEPTION 'health mangler pending_v2_total_is_estimate';
  END IF;

  RAISE NOTICE 'embedding_backlog_health_explain.sql: ok (pending_v2_active=%)', v_health->>'pending_v2_active';
END $$;
