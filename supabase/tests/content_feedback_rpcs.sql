-- Integrasjonstest for content_feedback (F1): grants, trigger, RPC-er og idempotent seed.
DO $$
DECLARE
  v_poll_id uuid;
  v_feedback_id uuid;
  v_count int;
  v_historic int;
  v_sources int;
  r jsonb;
  v_vec text := '[' || repeat('0,', 767) || '0]';
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

  SELECT count(*) INTO v_sources FROM public.content_sources WHERE domain = 'utenfilter.no';
  IF v_sources <> 1 THEN
    RAISE EXCEPTION 'forventet utenfilter.no i content_sources';
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

  r := public.n8n_upsert_source_items(
    jsonb_build_array(
      jsonb_build_object(
        'domain', 'utenfilter.no',
        'external_id', 'ci-123',
        'url', 'https://utenfilter.no/ci-test',
        'title', 'CI artikkel',
        'excerpt', 'Ingress',
        'categories', jsonb_build_array('Test')
      )
    )
  );
  IF coalesce(r ->> 'ok', 'false') <> 'true' THEN
    RAISE EXCEPTION 'n8n_upsert_source_items feilet: %', r;
  END IF;

  r := public.n8n_upsert_source_items(
    jsonb_build_array(
      jsonb_build_object(
        'domain', 'utenfilter.no',
        'external_id', 'ci-123',
        'url', 'https://utenfilter.no/ci-test-2',
        'title', 'CI artikkel oppdatert'
      )
    )
  );
  IF (r ->> 'updated')::int <> 1 THEN
    RAISE EXCEPTION 'forventet dedupe-oppdatering på source_items';
  END IF;

  PERFORM public.n8n_set_feedback_embedding(v_feedback_id, v_vec::vector(768));

  r := public.n8n_feedback_similarity('reel', v_vec::vector(768));
  IF NOT (r ? 'max_sim_approved') THEN
    RAISE EXCEPTION 'n8n_feedback_similarity mangler felt';
  END IF;

  r := public.n8n_feedback_examples('reel', v_vec::vector(768), 2);
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

  DELETE FROM public.source_items WHERE external_id = 'ci-123' AND domain = 'utenfilter.no';
  DELETE FROM public.content_feedback WHERE content_id = v_poll_id::text;
  DELETE FROM public.polls WHERE id = v_poll_id;

  RAISE NOTICE 'content_feedback_rpcs.sql: OK';
END $$;
