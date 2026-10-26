-- CI: lease claim, expiry, concurrent workers, save idempotency

DO $$
DECLARE
  v_issue text := 'embed-v2-lease-issue';
  v_doc text := 'doc-lease';
  v_id1 uuid;
  v_id2 uuid;
  v_vec text;
  v_claimed int;
  v_save jsonb;
BEGIN
  IF to_regprocedure('public.n8n_claim_chunks_missing_v2(text,int,text,int)') IS NULL THEN
    RAISE NOTICE 'embedding_v2_claim_leases.sql: hopper over (migrasjon 26110300 ikke kjørt)';
    RETURN;
  END IF;

  IF (
    SELECT pg_get_functiondef('public.n8n_claim_chunks_missing_v2(text,int,text,int)'::regprocedure)
  ) ILIKE '%fm_embedding_v2_issue_tier(%' THEN
    RAISE EXCEPTION 'n8n_claim_chunks_missing_v2 skal ikke kalle fm_embedding_v2_issue_tier per rad';
  END IF;

  INSERT INTO public.stortinget_issues (id, title, last_synced_at, ferdigbehandlet, detail_json)
  VALUES (
    v_issue,
    'Lease test',
    now() - interval '30 days',
    true,
    '{"sak_sesjon":"1999-2000"}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    last_synced_at = now() - interval '30 days',
    ferdigbehandlet = true,
    detail_json = '{"sak_sesjon":"1999-2000"}'::jsonb;

  INSERT INTO public.stortinget_issue_documents (issue_id, document_id, title, document_type, ingest_status, chunks_status)
  VALUES (v_issue, v_doc, 'Innstilling', 'innstilling', 'ready', 'pending')
  ON CONFLICT DO NOTHING;

  DELETE FROM public.document_chunks WHERE issue_id = v_issue;

  INSERT INTO public.document_chunks (issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status)
  VALUES (v_issue, v_doc, 0, 'lease chunk a', 'pending', 'pending')
  RETURNING id INTO v_id1;

  INSERT INTO public.document_chunks (issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status)
  VALUES (v_issue, v_doc, 1, 'lease chunk b', 'pending', 'pending')
  RETURNING id INTO v_id2;

  IF (SELECT count(*) FROM public.n8n_claim_chunks_missing_v2('background', 10, 'worker-a', 300)) <> 2 THEN
    RAISE EXCEPTION 'claim: forventet 2 rader for worker-a';
  END IF;

  IF (SELECT count(*) FROM public.n8n_claim_chunks_missing_v2('background', 10, 'worker-b', 300)) <> 0 THEN
    RAISE EXCEPTION 'claim: worker-b skal ikke få allerede leasede rader';
  END IF;

  v_vec := '[' || repeat('0.001,', 1023) || '0.001]';

  v_save := public.save_embeddings_v2(
    jsonb_build_array(jsonb_build_object('id', v_id1::text, 'embedding', v_vec)),
    'test-model',
    false,
    'worker-wrong',
    300
  );
  IF coalesce((v_save->>'saved')::int, 0) <> 0 THEN
    RAISE EXCEPTION 'save: feil worker skal ikke lagre';
  END IF;

  v_save := public.save_embeddings_v2(
    jsonb_build_array(jsonb_build_object('id', v_id1::text, 'embedding', v_vec)),
    'test-model',
    false,
    'worker-a',
    300
  );
  IF coalesce((v_save->>'saved')::int, 0) <> 1 THEN
    RAISE EXCEPTION 'save: worker-a skal lagre én rad';
  END IF;

  v_save := public.save_embeddings_v2(
    jsonb_build_array(jsonb_build_object('id', v_id1::text, 'embedding', v_vec)),
    'test-model',
    false,
    'worker-a',
    300
  );
  IF coalesce((v_save->>'skipped')::int, 0) < 1 THEN
    RAISE EXCEPTION 'double save: forventet skipped på allerede embeddet chunk';
  END IF;

  UPDATE public.document_chunks
  SET embedding_v2_claimed_at = now() - interval '1 hour'
  WHERE id = v_id2;

  IF (SELECT count(*) FROM public.n8n_claim_chunks_missing_v2('background', 10, 'worker-c', 300)) <> 1 THEN
    RAISE EXCEPTION 'expired lease: worker-c skal reclaim v_id2';
  END IF;

  v_claimed := public.n8n_release_embedding_v2_claims('worker-c');
  IF v_claimed <> 1 THEN
    RAISE EXCEPTION 'release: forventet 1 rad frigitt';
  END IF;

  DELETE FROM public.document_chunks WHERE issue_id = v_issue;

  -- Lane / tier / doc-type ordering (26110400+)
  IF to_regprocedure('public.fm_embedding_v2_issue_tiers(text[])') IS NOT NULL THEN
    PERFORM public.n8n_release_embedding_v2_claims('worker-a');
    PERFORM public.n8n_release_embedding_v2_claims('worker-c');

    INSERT INTO public.stortinget_issues (id, title, last_synced_at, ferdigbehandlet, detail_json)
    VALUES
      ('embed-v2-fast-tier0', 'Fast', now(), false, '{"sak_sesjon":"2025-2026"}'::jsonb),
      ('embed-v2-order-t1', 'T1', now() - interval '60 days', true, '{"sak_sesjon":"2025-2026"}'::jsonb),
      ('embed-v2-order-t2a', 'T2a', now() - interval '60 days', true, '{"sak_sesjon":"1999-2000"}'::jsonb),
      ('embed-v2-order-t2b', 'T2b', now() - interval '60 days', true, '{"sak_sesjon":"1999-2000"}'::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      last_synced_at = EXCLUDED.last_synced_at,
      ferdigbehandlet = EXCLUDED.ferdigbehandlet,
      detail_json = EXCLUDED.detail_json;

    INSERT INTO public.stortinget_issue_documents (issue_id, document_id, title, document_type, ingest_status, chunks_status)
    VALUES
      ('embed-v2-fast-tier0', 'doc-fast', 'Hoved', 'hoveddokument', 'ready', 'pending'),
      ('embed-v2-order-t1', 'doc-t1', 'Innst', 'innstilling', 'ready', 'pending'),
      ('embed-v2-order-t2a', 'doc-t2a', 'Hoved', 'hoveddokument', 'ready', 'pending'),
      ('embed-v2-order-t2b', 'doc-t2b', 'Innst', 'innstilling', 'ready', 'pending')
    ON CONFLICT DO NOTHING;

    DELETE FROM public.document_chunks
    WHERE issue_id IN (
      'embed-v2-fast-tier0',
      'embed-v2-order-t1',
      'embed-v2-order-t2a',
      'embed-v2-order-t2b'
    );

    INSERT INTO public.document_chunks (issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status)
    VALUES
      ('embed-v2-fast-tier0', 'doc-fast', 0, 'fast lane', 'pending', 'pending'),
      ('embed-v2-order-t1', 'doc-t1', 0, 'tier1 chunk', 'pending', 'pending'),
      ('embed-v2-order-t2a', 'doc-t2a', 0, 'tier2 hoved', 'pending', 'pending'),
      ('embed-v2-order-t2b', 'doc-t2b', 0, 'tier2 innst', 'pending', 'pending');

    IF (SELECT count(*) FROM public.n8n_claim_chunks_missing_v2('fast', 10, 'lane-fast', 300)) <> 1 THEN
      RAISE EXCEPTION 'fast lane: forventet én tier-0 chunk';
    END IF;

    IF (
      SELECT c.issue_id
      FROM public.n8n_claim_chunks_missing_v2('fast', 10, 'lane-fast', 300) c
      LIMIT 1
    ) IS NOT NULL THEN
      RAISE EXCEPTION 'fast lane: ingen flere tier-0 chunks';
    END IF;

    PERFORM public.n8n_release_embedding_v2_claims('lane-fast');

    IF (
      SELECT array_agg(row.issue_id ORDER BY row.chunk_index, row.issue_id)
      FROM public.n8n_claim_chunks_missing_v2('background', 10, 'lane-bg', 300) row
    ) IS DISTINCT FROM ARRAY[
      'embed-v2-order-t1',
      'embed-v2-order-t2b',
      'embed-v2-order-t2a'
    ] THEN
      RAISE EXCEPTION 'background: feil tier/doc-type rekkefølge';
    END IF;

    PERFORM public.n8n_release_embedding_v2_claims('lane-bg');

    DELETE FROM public.document_chunks
    WHERE issue_id IN (
      'embed-v2-fast-tier0',
      'embed-v2-order-t1',
      'embed-v2-order-t2a',
      'embed-v2-order-t2b'
    );
  END IF;
END;
$$;
