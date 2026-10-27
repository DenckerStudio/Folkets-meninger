-- CI: system-poll RPCs accept v2-only embeddings and respect n8n_blocking_poll_id.

DO $$
DECLARE
  v_issue_v2 text := 'ci-system-poll-v2-only';
  v_issue_block text := 'ci-system-poll-blocked';
  v_doc text := 'doc-a';
  v_vec text := '[1' || repeat(',0', 1023) || ']';
  v_rows int;
  v_kind text;
  v_poll_id uuid;
  v_cov record;
BEGIN
  IF to_regprocedure('public.fm_chunk_has_usable_embedding(public.vector,text,public.vector,text)') IS NULL THEN
    RAISE NOTICE 'system_poll_usable_embedding_gates.sql: hopper over (migrasjon 26110100 ikke kjørt)';
    RETURN;
  END IF;
  IF to_regprocedure('public.n8n_list_sak_for_system_poll(text)') IS NULL THEN
    RAISE NOTICE 'system_poll_usable_embedding_gates.sql: hopper over (system-poll RPC mangler)';
    RETURN;
  END IF;

  PERFORM set_config('search_path', 'public', true);

  -- v2-only sak (no legacy nomic embedding)
  INSERT INTO public.stortinget_issues (id, title, summary, status, last_synced_at)
  VALUES (v_issue_v2, 'CI v2 poll sak', repeat('x', 90), 'pending', now())
  ON CONFLICT (id) DO UPDATE SET status = 'pending', summary = EXCLUDED.summary, last_synced_at = now();

  INSERT INTO public.stortinget_issue_documents (issue_id, document_id, title, document_type, ingest_status, chunks_status)
  VALUES (v_issue_v2, v_doc, 'Dok', 'innstilling', 'ready', 'ready')
  ON CONFLICT DO NOTHING;

  DELETE FROM public.document_chunks WHERE issue_id = v_issue_v2;

  INSERT INTO public.document_chunks (
    issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status, embedding_v2
  )
  VALUES (
    v_issue_v2, v_doc, 0, 'Innhold for system-poll test', 'pending', 'pending', v_vec::vector(1024)
  );

  IF NOT public.fm_chunk_has_usable_embedding(v_vec::vector(1024), 'pending', NULL, 'pending') THEN
    RAISE EXCEPTION 'fm_chunk_has_usable_embedding skulle akseptere v2-only';
  END IF;

  SELECT count(*)::int, max(source_kind)
  INTO v_rows, v_kind
  FROM public.n8n_list_sak_for_system_poll(v_issue_v2);

  IF v_rows <> 1 OR v_kind IS DISTINCT FROM 'rag' THEN
    RAISE EXCEPTION 'n8n_list_sak_for_system_poll forventet 1 rad source_kind=rag, fikk % %', v_rows, v_kind;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.get_sak_poll_candidates(50) c WHERE c.issue_id = v_issue_v2 AND c.rag_chunk_count >= 1
  ) THEN
    RAISE EXCEPTION 'get_sak_poll_candidates skulle inkludere v2-only sak';
  END IF;

  SELECT * INTO v_cov FROM public.get_sak_poll_coverage() LIMIT 1;
  IF coalesce(v_cov.pending_with_rag, 0) < 1 OR coalesce(v_cov.sak_candidates, 0) < 1 THEN
    RAISE EXCEPTION 'get_sak_poll_coverage uventet lav: %', v_cov;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.n8n_list_saks_without_blocking_poll(50, v_issue_v2)
  ) THEN
    RAISE EXCEPTION 'n8n_list_saks_without_blocking_poll skulle liste v2-only sak';
  END IF;

  -- Blocking poll: archived reel still blocks when unique index covers all statuses
  INSERT INTO public.stortinget_issues (id, title, summary, status, last_synced_at)
  VALUES (v_issue_block, 'CI blocked sak', repeat('y', 90), 'pending', now())
  ON CONFLICT (id) DO UPDATE SET status = 'pending', last_synced_at = now();

  INSERT INTO public.document_chunks (
    issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status, embedding_v2
  )
  VALUES (
    v_issue_block, v_doc, 0, 'blocked', 'pending', 'pending', v_vec::vector(1024)
  );

  v_poll_id := public.create_system_poll_draft(
    v_issue_block,
    'CI blokkerende reel',
    'Sammendrag',
    '[]'::jsonb,
    '{}'::jsonb
  );
  PERFORM public.publish_poll(v_poll_id);
  PERFORM public.archive_poll(v_poll_id);

  IF public.n8n_blocking_poll_id(v_issue_block) IS NULL THEN
    RAISE NOTICE 'system_poll_usable_embedding_gates.sql: unique index tillater ny poll etter archive — hopper over blocking-sjekk';
  ELSE
    SELECT count(*)::int INTO v_rows FROM public.n8n_list_sak_for_system_poll(v_issue_block);
    IF v_rows <> 0 THEN
      RAISE EXCEPTION 'n8n_list_sak_for_system_poll skulle ikke returnere sak med blokkerende poll';
    END IF;
    IF EXISTS (SELECT 1 FROM public.n8n_list_saks_without_blocking_poll(50, v_issue_block)) THEN
      RAISE EXCEPTION 'n8n_list_saks_without_blocking_poll skulle ekskludere blokkerende sak';
    END IF;
  END IF;

  IF has_function_privilege('anon', 'public.n8n_list_sak_for_system_poll(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon skal ikke kjøre n8n_list_sak_for_system_poll';
  END IF;

  RAISE NOTICE 'system_poll_usable_embedding_gates.sql: ok';
END $$;
