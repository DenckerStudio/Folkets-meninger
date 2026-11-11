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
  v_row record;
  v_i int;
  v_prog_count int;
  v_prog_id uuid;
  v_pg_claim_issue text;
  v_pg_claim_content text;
  v_tier_hi int;
  v_tier_lo int;
  v_pg_fixture_id text;
  v_expected_order text[] := ARRAY[
    'embed-v2-order-t2b',
    'embed-v2-order-t2a'
  ];
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

  IF to_regprocedure('public.fm_embedding_v2_issue_tiers(text[])') IS NOT NULL THEN
    IF (
      SELECT pg_get_functiondef('public.fm_embedding_v2_issue_tiers(text[])'::regprocedure)
    ) NOT ILIKE '%has_pending%EXISTS%' THEN
      RAISE EXCEPTION 'fm_embedding_v2_issue_tiers has_pending må bruke EXISTS per issue_id';
    END IF;
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

    DELETE FROM public.document_chunks
    WHERE issue_id IN ('embed-v2-test-issue', 'explain-tier0');

    UPDATE public.document_chunks
    SET
      embedding_v2_claimed_at = NULL,
      embedding_v2_claimed_by = NULL
    WHERE embedding_v2 IS NULL;

    DELETE FROM public.polls
    WHERE stortinget_issue_id IN (
      'embed-v2-fast-tier0',
      'embed-v2-order-t2a',
      'embed-v2-order-t2b'
    );

    INSERT INTO public.stortinget_issues (id, title, last_synced_at, ferdigbehandlet, detail_json)
    VALUES
      ('embed-v2-fast-tier0', 'Fast', now(), false, '{"sak_sesjon":"2025-2026"}'::jsonb),
      ('embed-v2-order-t2a', 'T2a', now() - interval '60 days', true, '{"sak_sesjon":"1999-2000"}'::jsonb),
      ('embed-v2-order-t2b', 'T2b', now() - interval '60 days', true, '{"sak_sesjon":"1999-2000"}'::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      last_synced_at = EXCLUDED.last_synced_at,
      ferdigbehandlet = EXCLUDED.ferdigbehandlet,
      detail_json = EXCLUDED.detail_json;

    DELETE FROM public.stortinget_issue_documents
    WHERE issue_id IN (
      'embed-v2-fast-tier0',
      'embed-v2-order-t2a',
      'embed-v2-order-t2b'
    );

    INSERT INTO public.stortinget_issue_documents (issue_id, document_id, title, document_type, ingest_status, chunks_status)
    VALUES
      ('embed-v2-fast-tier0', 'doc-fast', 'Hoved', 'hoveddokument', 'ready', 'pending'),
      ('embed-v2-order-t2a', 'doc-t2a', 'Hoved', 'hoveddokument', 'ready', 'pending'),
      ('embed-v2-order-t2b', 'doc-t2b', 'Innst', 'innstilling', 'ready', 'pending');

    DELETE FROM public.document_chunks
    WHERE issue_id IN (
      'embed-v2-fast-tier0',
      'embed-v2-order-t2a',
      'embed-v2-order-t2b'
    );

    INSERT INTO public.document_chunks (issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status)
    VALUES
      ('embed-v2-fast-tier0', 'doc-fast', 0, 'fast lane', 'pending', 'pending'),
      ('embed-v2-order-t2a', 'doc-t2a', 0, 'tier2 hoved', 'pending', 'pending'),
      ('embed-v2-order-t2b', 'doc-t2b', 0, 'tier2 innst', 'pending', 'pending');

    DELETE FROM public.document_chunks
    WHERE embedding_v2 IS NULL
      AND embedding_v2_status = 'pending'
      AND issue_id NOT IN (
        'embed-v2-fast-tier0',
        'embed-v2-order-t2a',
        'embed-v2-order-t2b'
      );

    IF public.fm_embedding_v2_issue_tier('embed-v2-fast-tier0') IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'fixture: fast-tier0 må være tier 0';
    END IF;

    IF (
      SELECT c.issue_id
      FROM public.n8n_claim_chunks_missing_v2('fast', 1, 'lane-fast', 300) c
      LIMIT 1
    ) IS DISTINCT FROM 'embed-v2-fast-tier0' THEN
      RAISE EXCEPTION 'fast lane: forventet tier-0 chunk fra embed-v2-fast-tier0';
    END IF;

    IF (
      SELECT count(*)::int
      FROM public.n8n_claim_chunks_missing_v2('fast', 1, 'lane-fast', 300) c
    ) <> 0 THEN
      RAISE EXCEPTION 'fast lane: ingen flere tier-0 chunks etter første claim';
    END IF;

    PERFORM public.n8n_release_embedding_v2_claims('lane-fast');

    IF coalesce(public.fm_embedding_v2_issue_tier('embed-v2-order-t2a'), -1)
      IS DISTINCT FROM coalesce(public.fm_embedding_v2_issue_tier('embed-v2-order-t2b'), -1) THEN
      RAISE EXCEPTION 'fixture: t2a/t2b må ha samme tier for doc-type rekkefølgetest';
    END IF;

    v_i := 0;
    FOR v_row IN
      SELECT * FROM public.n8n_claim_chunks_missing_v2('background', 10, 'lane-bg', 300)
    LOOP
      v_i := v_i + 1;
      IF v_row.issue_id IS DISTINCT FROM v_expected_order[v_i] THEN
        RAISE EXCEPTION 'background: pos % forventet %, fikk %', v_i, v_expected_order[v_i], v_row.issue_id;
      END IF;
    END LOOP;
    IF v_i <> array_length(v_expected_order, 1) THEN
      RAISE EXCEPTION 'background: forventet % claims, fikk %', array_length(v_expected_order, 1), v_i;
    END IF;

    PERFORM public.n8n_release_embedding_v2_claims('lane-bg');

    DELETE FROM public.document_chunks
    WHERE issue_id IN (
      'embed-v2-fast-tier0',
      'embed-v2-order-t2a',
      'embed-v2-order-t2b'
    );

    -- Set-based pick per sort_tier (20261111090000)
    DELETE FROM public.document_chunks
    WHERE issue_id LIKE 'embed-v2-pg-%'
      OR issue_id LIKE 'embed-v2-pg-ws-%';

    DELETE FROM public.stortinget_issue_documents
    WHERE issue_id LIKE 'embed-v2-pg-%'
      OR issue_id LIKE 'embed-v2-pg-ws-%';

    DELETE FROM public.stortinget_issues
    WHERE id LIKE 'embed-v2-pg-%'
      OR id LIKE 'embed-v2-pg-ws-%';

    DELETE FROM public.document_chunks
    WHERE embedding_v2 IS NULL
      AND embedding_v2_status = 'pending'
      AND (issue_id IS NULL OR issue_id NOT LIKE 'embed-v2-pg%');

    -- (a) Høyere prioritet (lav sort_tier): kun whitespace i plukk; lavere prioritet har embeddbar
    INSERT INTO public.stortinget_issues (id, title, last_synced_at, ferdigbehandlet, detail_json)
    VALUES
      ('embed-v2-pg-hi-ws', 'WS hi', now() - interval '60 days', true, '{"sak_sesjon":"1999-2000"}'::jsonb),
      ('embed-v2-pg-lo-good--referatsak', 'Good lo', now() - interval '60 days', true, '{"sak_sesjon":"1999-2000"}'::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      last_synced_at = EXCLUDED.last_synced_at,
      ferdigbehandlet = EXCLUDED.ferdigbehandlet,
      detail_json = EXCLUDED.detail_json;

    UPDATE public.stortinget_issues
    SET last_updated_at = now() - interval '60 days'
    WHERE id IN ('embed-v2-pg-hi-ws', 'embed-v2-pg-lo-good--referatsak');

    INSERT INTO public.stortinget_issue_documents (issue_id, document_id, title, document_type, ingest_status, chunks_status)
    VALUES
      ('embed-v2-pg-hi-ws', 'doc-hi', 'Tom', 'innstilling', 'ready', 'pending'),
      ('embed-v2-pg-lo-good--referatsak', 'doc-lo', 'Innst', 'innstilling', 'ready', 'pending');

    -- has_pending via «ghost» (ikke claimbar pga attempts); kun whitespace er discoverybare
    INSERT INTO public.document_chunks (
      issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status, embedding_v2_attempts
    )
    VALUES
      ('embed-v2-pg-hi-ws', 'doc-hi', 0, 'ghost has_pending', 'pending', 'pending', 3),
      ('embed-v2-pg-hi-ws', 'doc-hi', 1, '', 'pending', 'pending', 0),
      ('embed-v2-pg-lo-good--referatsak', 'doc-lo', 0, 'tier2 innst', 'pending', 'pending', 0);

    v_tier_hi := coalesce(
      (SELECT coalesce(t.tier, 99) FROM public.fm_embedding_v2_issue_tiers(ARRAY['embed-v2-pg-hi-ws']) t LIMIT 1),
      99
    );
    v_tier_lo := coalesce(
      (SELECT coalesce(t.tier, 99) FROM public.fm_embedding_v2_issue_tiers(ARRAY['embed-v2-pg-lo-good--referatsak']) t LIMIT 1),
      99
    );

    IF v_tier_hi >= v_tier_lo THEN
      RAISE EXCEPTION 'progress guard (a): forventet høyere prioritet (lavere sort_tier) på hi-ws (%, %)',
        v_tier_hi, v_tier_lo;
    END IF;

    SELECT c.issue_id
    INTO v_pg_claim_issue
    FROM public.n8n_claim_chunks_missing_v2('background', 3, 'pg-tier-ab', 300) c
    LIMIT 1;

    IF v_pg_claim_issue IS DISTINCT FROM 'embed-v2-pg-lo-good--referatsak' THEN
      RAISE EXCEPTION 'progress guard (a): forventet embed-v2-pg-lo-good--referatsak, fikk %', v_pg_claim_issue;
    END IF;

    PERFORM public.n8n_release_embedding_v2_claims('pg-tier-ab');

    DELETE FROM public.document_chunks
    WHERE issue_id IN ('embed-v2-pg-hi-ws', 'embed-v2-pg-lo-good--referatsak');

    -- (b) 100+ whitespace-issues foran én embeddbar i samme sort_tier (ingen kap-tap)
    FOR v_i IN 1..105 LOOP
      v_pg_fixture_id := format('embed-v2-pg-ws-%s', lpad(v_i::text, 4, '0'));
      INSERT INTO public.stortinget_issues (id, title, last_synced_at, ferdigbehandlet, detail_json)
      VALUES (
        v_pg_fixture_id,
        'WS',
        now() - interval '60 days',
        true,
        '{"sak_sesjon":"1999-2000"}'::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET last_updated_at = now() - interval '60 days';

      UPDATE public.stortinget_issues
      SET last_updated_at = now() - interval '60 days'
      WHERE id = v_pg_fixture_id;

      INSERT INTO public.stortinget_issue_documents (issue_id, document_id, title, document_type, ingest_status, chunks_status)
      VALUES (v_pg_fixture_id, 'd', 'D', 'innstilling', 'ready', 'pending')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.document_chunks (issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status)
      VALUES (v_pg_fixture_id, 'd', 0, '', 'pending', 'pending');
    END LOOP;

    INSERT INTO public.stortinget_issues (id, title, last_synced_at, ferdigbehandlet, detail_json)
    VALUES (
      'embed-v2-pg-ws-good',
      'Good',
      now() - interval '60 days',
      true,
      '{"sak_sesjon":"1999-2000"}'::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET last_updated_at = now() - interval '60 days';

    UPDATE public.stortinget_issues
    SET last_updated_at = now() - interval '60 days'
    WHERE id = 'embed-v2-pg-ws-good';

    INSERT INTO public.stortinget_issue_documents (issue_id, document_id, title, document_type, ingest_status, chunks_status)
    VALUES ('embed-v2-pg-ws-good', 'dg', 'G', 'innstilling', 'ready', 'pending')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.document_chunks (issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status)
    VALUES ('embed-v2-pg-ws-good', 'dg', 0, 'embed me', 'pending', 'pending');

    DELETE FROM public.document_chunks
    WHERE embedding_v2 IS NULL
      AND embedding_v2_status = 'pending'
      AND issue_id NOT LIKE 'embed-v2-pg-ws-%'
      AND issue_id <> 'embed-v2-pg-ws-good';

    SELECT c.issue_id
    INTO v_pg_claim_issue
    FROM public.n8n_claim_chunks_missing_v2('background', 1, 'pg-ws-many', 300) c
    LIMIT 1;

    IF v_pg_claim_issue IS DISTINCT FROM 'embed-v2-pg-ws-good' THEN
      RAISE EXCEPTION 'progress guard (b): forventet embed-v2-pg-ws-good etter 105 ws-issues, fikk %', v_pg_claim_issue;
    END IF;

    PERFORM public.n8n_release_embedding_v2_claims('pg-ws-many');

    -- (c) Kun whitespace-pending → 0 rader
    DELETE FROM public.document_chunks WHERE issue_id = 'embed-v2-pg-ws-good';

    IF (
      SELECT count(*)::int
      FROM public.n8n_claim_chunks_missing_v2('background', 16, 'pg-exhaust', 300)
    ) <> 0 THEN
      RAISE EXCEPTION 'progress guard (c): kun tomme pending chunks skal gi 0 rader';
    END IF;

    -- (d) Leased rad hoppes over; neste embeddbare returneres
    INSERT INTO public.document_chunks (issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status)
    VALUES ('embed-v2-pg-ws-good', 'dg', 0, 'first locked', 'pending', 'pending')
    RETURNING id INTO v_id1;

    INSERT INTO public.document_chunks (issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status)
    VALUES ('embed-v2-pg-ws-good', 'dg', 1, 'second free', 'pending', 'pending')
    RETURNING id INTO v_id2;

    UPDATE public.document_chunks
    SET
      embedding_v2_claimed_at = now(),
      embedding_v2_claimed_by = 'other-worker'
    WHERE id = v_id1;

    SELECT c.id, c.content
    INTO v_prog_id, v_pg_claim_content
    FROM public.n8n_claim_chunks_missing_v2('background', 1, 'pg-skip-lock', 300) c
    LIMIT 1;

    IF v_prog_id IS DISTINCT FROM v_id2 OR v_pg_claim_content IS DISTINCT FROM 'second free' THEN
      RAISE EXCEPTION 'progress guard (d): forventet andre chunk etter lease, fikk % / %',
        v_prog_id, v_pg_claim_content;
    END IF;

    PERFORM public.n8n_release_embedding_v2_claims('pg-skip-lock');

    DELETE FROM public.document_chunks
    WHERE issue_id LIKE 'embed-v2-pg-ws-%' OR issue_id LIKE 'embed-v2-pg-%';
    DELETE FROM public.stortinget_issue_documents
    WHERE issue_id LIKE 'embed-v2-pg-ws-%' OR issue_id LIKE 'embed-v2-pg-%';
    DELETE FROM public.stortinget_issues
    WHERE id LIKE 'embed-v2-pg-ws-%' OR id LIKE 'embed-v2-pg-%';
  END IF;
END;
$$;
