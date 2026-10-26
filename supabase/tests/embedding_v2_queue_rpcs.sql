-- CI: embedding v2 queue RPCs (ordering, null guard, health, grants)

DO $$
DECLARE
  v_issue text := 'embed-v2-test-issue';
  v_doc text := 'doc-main';
  v_id1 uuid;
  v_id2 uuid;
  v_vec text;
  v_health jsonb;
  v_save jsonb;
BEGIN
  IF to_regprocedure('public.n8n_list_chunks_missing_v2_for_issue(text,int)') IS NULL THEN
    RAISE NOTICE 'embedding_v2_queue_rpcs.sql: hopper over (migrasjon 26110100 ikke kjørt)';
    RETURN;
  END IF;

  INSERT INTO public.stortinget_issues (id, title, last_synced_at, ferdigbehandlet, detail_json)
  VALUES (v_issue, 'Test', now(), false, '{"sak_sesjon":"2025-2026"}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET last_synced_at = now(), ferdigbehandlet = false;

  INSERT INTO public.stortinget_issue_documents (issue_id, document_id, title, document_type, ingest_status, chunks_status)
  VALUES (v_issue, v_doc, 'Innstilling', 'innstilling', 'ready', 'pending')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.document_chunks (issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status)
  VALUES (v_issue, v_doc, 1, 'chunk en', 'pending', 'pending')
  RETURNING id INTO v_id1;

  INSERT INTO public.document_chunks (issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status)
  VALUES (v_issue, v_doc, 0, 'chunk null', 'pending', 'pending')
  RETURNING id INTO v_id2;

  IF (
    SELECT array_agg(row.chunk_index ORDER BY row.chunk_index)
    FROM public.n8n_list_chunks_missing_v2_for_issue(v_issue, 10) row
  ) IS DISTINCT FROM ARRAY[0, 1] THEN
    RAISE EXCEPTION 'forventet chunk_index 0,1 rekkefølge';
  END IF;

  v_save := public.n8n_save_document_embedding(v_id1, NULL);
  IF coalesce(v_save->>'error', '') <> 'null_embedding' THEN
    RAISE EXCEPTION 'null embedding skal avvises: %', v_save;
  END IF;

  v_health := public.n8n_embedding_backlog_health();
  IF NOT (v_health ? 'pending_v2_total') OR NOT (v_health ? 'failed_v2') THEN
    RAISE EXCEPTION 'health mangler felt: %', v_health;
  END IF;

  IF has_function_privilege('anon', 'public.n8n_embedding_backlog_health()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon skal ikke kjøre n8n_embedding_backlog_health';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.n8n_list_v2_priority_issues(int,int,int,int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role mangler EXECUTE på n8n_list_v2_priority_issues';
  END IF;

  RAISE NOTICE 'embedding_v2_queue_rpcs.sql: ok';
END $$;
