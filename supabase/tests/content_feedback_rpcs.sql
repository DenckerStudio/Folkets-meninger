-- Integrasjonstest for content_feedback (F1): grants, trigger, RPC-er og idempotent seed.
DO $$
DECLARE
  v_poll_id uuid;
  v_poll_archive_id uuid;
  v_poll_admin_id uuid;
  v_feedback_id uuid;
  v_count int;
  v_historic int;
  v_sources int;
  r jsonb;
  v_vec text := '[' || repeat('0,', 1023) || '0]';
  v_vec_bad text := '[' || repeat('0,', 767) || '0]';
  v_modified_before timestamptz;
  v_modified_after timestamptz;
  v_emb_model text;
  v_title text;
  v_excerpt text;
BEGIN
  IF to_regclass('public.content_feedback') IS NULL THEN
    RAISE NOTICE 'content_feedback_rpcs.sql: hopper over (tabell finnes ikke)';
    RETURN;
  END IF;

  -- Privilegier: anon/authenticated uten skriv/execute, service_role inn
  IF has_table_privilege('anon', 'public.content_feedback', 'INSERT,UPDATE,DELETE,TRUNCATE') THEN
    RAISE EXCEPTION 'anon skal ikke kunne skrive i content_feedback';
  END IF;
  IF has_table_privilege('authenticated', 'public.content_feedback', 'INSERT,UPDATE,DELETE,TRUNCATE') THEN
    RAISE EXCEPTION 'authenticated skal ikke kunne skrive i content_feedback';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.content_feedback', 'INSERT') THEN
    RAISE EXCEPTION 'service_role mangler INSERT på content_feedback';
  END IF;

  IF has_function_privilege('anon', 'public.upsert_content_feedback(text,text,text,jsonb,text[],text,uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon skal ikke kunne kjøre upsert_content_feedback';
  END IF;
  IF has_function_privilege('authenticated', 'public.upsert_content_feedback(text,text,text,jsonb,text[],text,uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated skal ikke kunne kjøre upsert_content_feedback';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.n8n_upsert_source_items(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role mangler EXECUTE på n8n_upsert_source_items';
  END IF;

  IF has_function_privilege('anon', 'public.assert_bge_m3_embedding(vector)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon skal ikke kunne kjøre assert_bge_m3_embedding';
  END IF;
  IF has_function_privilege('authenticated', 'public.parse_source_item_categories(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated skal ikke kunne kjøre parse_source_item_categories';
  END IF;
  IF has_function_privilege('anon', 'public.build_poll_reel_feedback_snapshot(public.polls)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon skal ikke kunne kjøre build_poll_reel_feedback_snapshot';
  END IF;

  SELECT count(*) INTO v_sources FROM public.content_sources WHERE domain = 'utenfilter.no';
  IF v_sources <> 1 THEN
    RAISE EXCEPTION 'forventet utenfilter.no i content_sources';
  END IF;

  IF (SELECT tier FROM public.content_sources WHERE domain = 'utenfilter.no') <> 'primary' THEN
    RAISE EXCEPTION 'utenfilter.no skal ha tier primary';
  END IF;
  IF (SELECT base_weight FROM public.content_sources WHERE domain = 'utenfilter.no')::numeric <> 1.50 THEN
    RAISE EXCEPTION 'utenfilter.no skal ha base_weight 1.5';
  END IF;
  IF (SELECT ingest ->> 'base_url' FROM public.content_sources WHERE domain = 'utenfilter.no')
    <> 'https://www.utenfilter.no' THEN
    RAISE EXCEPTION 'utenfilter.no ingest.base_url skal være https://www.utenfilter.no';
  END IF;

  IF has_function_privilege('anon', 'public.normalize_content_source_domain(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon skal ikke kunne kjøre normalize_content_source_domain';
  END IF;

  SELECT count(*) INTO v_historic
  FROM public.content_feedback
  WHERE source = 'historic';

  -- Idempotent seed: re-kjør historikk-INSERT (samme logikk som migrasjonen)
  INSERT INTO public.content_feedback (
    content_type, content_id, verdict, source, snapshot, created_at
  )
  SELECT
    'reel',
    p.id::text,
    CASE WHEN p.status IN ('open', 'closed') THEN 'approve' ELSE 'reject' END,
    'historic',
    public.build_poll_reel_feedback_snapshot(p),
    coalesce(p.updated_at, p.created_at, now())
  FROM public.polls p
  WHERE p.track = 'system'
    AND p.status IN ('open', 'closed', 'archived')
    AND NOT EXISTS (
      SELECT 1 FROM public.content_feedback cf
      WHERE cf.content_type = 'reel' AND cf.content_id = p.id::text AND cf.source = 'historic'
    )
  ON CONFLICT (content_type, content_id) WHERE superseded_at IS NULL DO NOTHING;

  SELECT count(*) INTO v_count
  FROM public.content_feedback
  WHERE source = 'historic';

  IF v_count <> v_historic THEN
    RAISE EXCEPTION 'historikk-seed skal være idempotent (før %, etter %)', v_historic, v_count;
  END IF;

  -- Trigger via publish_poll / archive_poll
  v_poll_id := public.create_system_poll_draft(
    'ci-content-feedback-' || substr(gen_random_uuid()::text, 1, 8),
    'CI test-reel for content_feedback',
    'Kort sammendrag',
    '[]'::jsonb,
    '{}'::jsonb
  );

  DELETE FROM public.content_feedback WHERE content_id = v_poll_id::text;

  PERFORM public.publish_poll(v_poll_id);

  SELECT count(*) INTO v_count
  FROM public.content_feedback
  WHERE content_type = 'reel'
    AND content_id = v_poll_id::text
    AND source = 'auto'
    AND verdict = 'approve'
    AND superseded_at IS NULL;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'publish_poll skulle skrive én auto approve-rad, fant %', v_count;
  END IF;

  -- publish → archive på system-reel: auto-rad skal bli reject (ikke bli approve)
  v_poll_archive_id := public.create_system_poll_draft(
    'ci-content-feedback-archive-' || substr(gen_random_uuid()::text, 1, 8),
    'CI archive test-reel',
    'Sammendrag',
    '[]'::jsonb,
    '{}'::jsonb
  );
  DELETE FROM public.content_feedback WHERE content_id = v_poll_archive_id::text;
  PERFORM public.publish_poll(v_poll_archive_id);
  PERFORM public.archive_poll(v_poll_archive_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.content_feedback
    WHERE content_type = 'reel'
      AND content_id = v_poll_archive_id::text
      AND source = 'auto'
      AND verdict = 'reject'
      AND superseded_at IS NULL
  ) THEN
    RAISE EXCEPTION 'publish→archive skulle gi auto reject';
  END IF;

  -- admin-rad skal ikke overskrives av archive-trigger
  v_poll_admin_id := public.create_system_poll_draft(
    'ci-content-feedback-admin-' || substr(gen_random_uuid()::text, 1, 8),
    'CI admin guard reel',
    'Sammendrag',
    '[]'::jsonb,
    '{}'::jsonb
  );
  DELETE FROM public.content_feedback WHERE content_id = v_poll_admin_id::text;
  PERFORM public.publish_poll(v_poll_admin_id);
  PERFORM public.upsert_content_feedback(
    'reel',
    v_poll_admin_id::text,
    'approve',
    jsonb_build_object('title', '+'),
    ARRAY['behold']::text[],
    'Admin-notat',
    NULL,
    '{}'::jsonb
  );
  PERFORM public.archive_poll(v_poll_admin_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.content_feedback
    WHERE content_type = 'reel'
      AND content_id = v_poll_admin_id::text
      AND source = 'admin'
      AND verdict = 'approve'
      AND superseded_at IS NULL
  ) THEN
    RAISE EXCEPTION 'archive skal ikke overskrive admin content_feedback-rad';
  END IF;

  v_feedback_id := public.upsert_content_feedback(
    'reel',
    v_poll_id::text,
    'approve',
    jsonb_build_object('title', '+'),
    ARRAY['test_tag']::text[],
    'CI-notat',
    NULL,
    '{}'::jsonb
  );

  SELECT count(*) INTO v_count
  FROM public.content_feedback
  WHERE content_id = v_poll_id::text AND superseded_at IS NULL;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'upsert på auto-rad skal ikke lage ny rad';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.content_feedback
    WHERE id = v_feedback_id AND source = 'admin' AND aspects ->> 'title' = '+'
  ) THEN
    RAISE EXCEPTION 'auto-rad skulle oppgraderes til admin med aspekter';
  END IF;

  -- Feil embedding-dimensjon (768) skal feile
  BEGIN
    PERFORM public.n8n_set_feedback_embedding(v_feedback_id, v_vec_bad::vector);
    RAISE EXCEPTION 'forventet RAISE ved embedding dim 768';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%1024%' AND SQLERRM NOT LIKE '%dimension%' AND SQLERRM NOT LIKE '%dimensjon%' THEN
        RAISE EXCEPTION 'feil dimensjon ga uventet feil: %', SQLERRM;
      END IF;
  END;

  r := public.n8n_upsert_source_items(
    jsonb_build_array(
      jsonb_build_object(
        'domain', 'utenfilter.no',
        'external_id', 'ci-123',
        'url', 'https://utenfilter.no/ci-test',
        'title', 'CI artikkel',
        'excerpt', 'Ingress',
        'categories', jsonb_build_array('Test'),
        'embedding', v_vec,
        'embedding_model', 'bge-m3'
      )
    )
  );
  IF (r ->> 'upserted')::int <> 1 OR jsonb_array_length(coalesce(r -> 'skipped', '[]'::jsonb)) <> 0 THEN
    RAISE EXCEPTION 'n8n_upsert_source_items insert feilet: %', r;
  END IF;

  SELECT modified_at, embedding_model
  INTO v_modified_before, v_emb_model
  FROM public.source_items
  WHERE domain = 'utenfilter.no' AND external_id = 'ci-123';

  IF v_emb_model <> 'bge-m3' THEN
    RAISE EXCEPTION 'forventet embedding_model bge-m3, fikk %', v_emb_model;
  END IF;

  IF (SELECT embedding IS NULL FROM public.source_items WHERE domain = 'utenfilter.no' AND external_id = 'ci-123') THEN
    RAISE EXCEPTION 'forventet embedding etter insert';
  END IF;

  r := public.n8n_upsert_source_items(
    jsonb_build_array(
      jsonb_build_object(
        'domain', 'utenfilter.no',
        'external_id', 'ci-123',
        'url', 'https://utenfilter.no/ci-test-2',
        'title', 'CI artikkel oppdatert',
        'excerpt', 'Ny ingress',
        'embedding', null,
        'embedding_model', ''
      )
    )
  );
  IF (r ->> 'upserted')::int <> 1 THEN
    RAISE EXCEPTION 'forventet dedupe-oppdatering på source_items: %', r;
  END IF;

  SELECT modified_at, embedding_model, title, excerpt
  INTO v_modified_after, v_emb_model, v_title, v_excerpt
  FROM public.source_items
  WHERE domain = 'utenfilter.no' AND external_id = 'ci-123';

  IF v_modified_after <> v_modified_before THEN
    RAISE EXCEPTION 'modified_at skal ikke endres når feltet utelates ved oppdatering';
  END IF;

  IF v_emb_model <> 'bge-m3' THEN
    RAISE EXCEPTION 'tom embedding_model skal ikke overskrive eksisterende';
  END IF;

  IF (SELECT embedding IS NULL FROM public.source_items WHERE domain = 'utenfilter.no' AND external_id = 'ci-123') THEN
    RAISE EXCEPTION 'null embedding skal ikke overskrive eksisterende';
  END IF;

  IF v_title <> 'CI artikkel oppdatert' THEN
    RAISE EXCEPTION 'title skulle oppdateres';
  END IF;

  IF v_excerpt <> 'Ny ingress' THEN
    RAISE EXCEPTION 'excerpt skulle oppdateres';
  END IF;

  -- categories JSON null i batch skal ikke feile hele kallet
  r := public.n8n_upsert_source_items(
    jsonb_build_array(
      jsonb_build_object(
        'domain', 'utenfilter.no',
        'external_id', 'ci-null-cat',
        'url', 'https://utenfilter.no/null-cat',
        'title', 'Null kategori',
        'categories', null
      ),
      jsonb_build_object(
        'domain', 'utenfilter.no',
        'external_id', 'ci-456',
        'url', 'https://utenfilter.no/ci-456',
        'title', 'Med kategori',
        'categories', jsonb_build_array('EU')
      )
    )
  );
  IF (r ->> 'upserted')::int <> 2 THEN
    RAISE EXCEPTION 'batch med categories null feilet: %', r;
  END IF;
  IF (SELECT categories FROM public.source_items WHERE external_id = 'ci-null-cat') <> '{}'::text[] THEN
    RAISE EXCEPTION 'JSON null categories skulle bli tom array';
  END IF;

  -- delvis oppdatering uten url/title på eksisterende rad
  r := public.n8n_upsert_source_items(
    jsonb_build_array(
      jsonb_build_object(
        'domain', 'utenfilter.no',
        'external_id', 'ci-123',
        'excerpt', 'Kun excerpt'
      )
    )
  );
  IF (r ->> 'upserted')::int <> 1 THEN
    RAISE EXCEPTION 'delvis oppdatering uten url/title feilet: %', r;
  END IF;
  IF (SELECT excerpt FROM public.source_items WHERE external_id = 'ci-123') <> 'Kun excerpt' THEN
    RAISE EXCEPTION 'excerpt skulle oppdateres uten url/title';
  END IF;

  r := public.n8n_upsert_source_items(
    jsonb_build_array(
      jsonb_build_object(
        'domain', 'utenfilter.no',
        'external_id', 'ci-new-missing-url',
        'title', 'Mangler url'
      )
    )
  );
  IF (r ->> 'upserted')::int <> 0 OR jsonb_array_length(r -> 'skipped') <> 1 THEN
    RAISE EXCEPTION 'ny rad uten url skal telles som skipped, fikk %', r;
  END IF;

  -- batch: 1 ugyldig + 2 gyldige → upserted 2, skipped 1
  r := public.n8n_upsert_source_items(
    jsonb_build_array(
      jsonb_build_object(
        'domain', 'www.Utenfilter.no',
        'external_id', 'ci-batch-1',
        'url', 'https://www.utenfilter.no/b1',
        'title', 'Batch 1'
      ),
      jsonb_build_object(
        'domain', 'utenfilter.no',
        'external_id', 'ci-batch-bad',
        'title', 'Mangler url'
      ),
      jsonb_build_object(
        'domain', 'WWW.utenfilter.no',
        'external_id', 'ci-batch-2',
        'url', 'https://www.utenfilter.no/b2',
        'title', 'Batch 2'
      )
    )
  );
  IF (r ->> 'upserted')::int <> 2 OR jsonb_array_length(r -> 'skipped') <> 1 THEN
    RAISE EXCEPTION 'batch 2+1 feilet: %', r;
  END IF;

  IF (SELECT count(*) FROM public.n8n_list_source_items('www.utenfilter.no')) < 1 THEN
    RAISE EXCEPTION 'n8n_list_source_items skal finne rader for www-domene';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.n8n_list_source_items('utenfilter.no', NULL, 10) l
    WHERE l.external_id = 'ci-batch-1' AND l.has_embedding IS FALSE
  ) THEN
    RAISE EXCEPTION 'n8n_list_source_items skal returnere metadata uten embedding';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.n8n_list_source_items(text,timestamptz,int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role mangler EXECUTE på n8n_list_source_items';
  END IF;

  BEGIN
    r := public.n8n_upsert_source_items(
      jsonb_build_array(
        jsonb_build_object(
          'domain', 'utenfilter.no',
          'external_id', 'ci-bad-dim',
          'url', 'https://utenfilter.no/bad',
          'title', 'Bad dim',
          'embedding', v_vec_bad
        )
      )
    );
    RAISE EXCEPTION 'forventet RAISE ved source_items embedding dim 768';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%1024%' AND SQLERRM NOT LIKE '%bge-m3%' AND SQLERRM NOT LIKE '%dimensjon%' THEN
        RAISE EXCEPTION 'feil dimensjon på source_items ga uventet feil: %', SQLERRM;
      END IF;
  END;

  PERFORM public.n8n_set_feedback_embedding(v_feedback_id, v_vec::vector(1024));

  r := public.n8n_feedback_similarity('reel', v_vec::vector(1024));
  IF NOT (r ? 'max_sim_approved') THEN
    RAISE EXCEPTION 'n8n_feedback_similarity mangler felt';
  END IF;

  r := public.n8n_feedback_examples('reel', v_vec::vector(1024), 2);
  IF jsonb_typeof(r -> 'similar') <> 'object' THEN
    RAISE EXCEPTION 'n8n_feedback_examples returnerte ugyldig similar';
  END IF;

  -- RLS: vanlig authenticated uten admin ser 0 rader
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM public.content_feedback;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'authenticated uten admin skal se 0 content_feedback-rader, fant %', v_count;
  END IF;
  RESET ROLE;

  DELETE FROM public.source_items
  WHERE domain = 'utenfilter.no'
    AND external_id IN (
      'ci-123',
      'ci-bad-dim',
      'ci-null-cat',
      'ci-456',
      'ci-batch-1',
      'ci-batch-2'
    );
  DELETE FROM public.content_feedback
  WHERE content_id IN (v_poll_id::text, v_poll_archive_id::text, v_poll_admin_id::text);
  DELETE FROM public.polls
  WHERE id IN (v_poll_id, v_poll_archive_id, v_poll_admin_id);

  RAISE NOTICE 'content_feedback_rpcs.sql: OK';
END $$;
