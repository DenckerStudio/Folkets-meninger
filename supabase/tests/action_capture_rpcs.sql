-- Integrasjonstest for upsert_action_capture / set_action_cluster_verdict (CI db-security).
DO $$
DECLARE
  r jsonb;
  v_excerpt_len int;
  v_action_key text := 'test:cursor-action-capture-rpc';
BEGIN
  IF to_regclass('public.action_clusters') IS NULL THEN
    RAISE NOTICE 'action_capture_rpcs.sql: hopper over (action_clusters finnes ikke)';
    RETURN;
  END IF;

  IF to_regprocedure('public.upsert_action_capture(jsonb,jsonb)') IS NULL THEN
    RAISE NOTICE 'action_capture_rpcs.sql: hopper over (RPC ikke migrert)';
    RETURN;
  END IF;

  DELETE FROM public.action_clusters WHERE action_key = v_action_key;

  r := public.upsert_action_capture(
    jsonb_build_object(
      'action_key', v_action_key,
      'action_type', 'opprop',
      'action_name', 'Test opprop for CI',
      'description_nb', 'Kort testbeskrivelse fra action_capture_rpcs.sql',
      'independent_publishers', jsonb_build_array('nrk.no', 'example.com'),
      'max_confidence', 0.42
    ),
    jsonb_build_array(
      jsonb_build_object(
        'item_key', 'news_rss:https://example.com/ci-action-capture',
        'url_canonical', 'https://example.com/ci-action-capture',
        'source_type', 'news_rss',
        'publisher', 'example.com',
        'title', 'Testartikkel',
        'excerpt', repeat('æ', 400)
      )
    )
  );

  IF coalesce(r ->> 'ok', 'false') <> 'true' THEN
    RAISE EXCEPTION 'upsert_action_capture insert feilet: %', r;
  END IF;
  IF (r ->> 'inserted_sources')::int <> 1 THEN
    RAISE EXCEPTION 'forventet inserted_sources=1, fikk %', r;
  END IF;

  SELECT char_length(excerpt)
  INTO v_excerpt_len
  FROM public.action_sources
  WHERE item_key = 'news_rss:https://example.com/ci-action-capture';

  IF v_excerpt_len IS NULL OR v_excerpt_len > 300 THEN
    RAISE EXCEPTION 'excerpt skulle trims til max 300, fikk lengde %', v_excerpt_len;
  END IF;

  r := public.upsert_action_capture(
    jsonb_build_object(
      'action_key', v_action_key,
      'max_confidence', 0.88,
      'independent_publishers', jsonb_build_array('vg.no')
    ),
    jsonb_build_array(
      jsonb_build_object(
        'item_key', 'news_rss:https://example.com/ci-action-capture',
        'url_canonical', 'https://example.com/ci-action-capture',
        'source_type', 'news_rss',
        'publisher', 'example.com'
      )
    )
  );

  IF (r ->> 'updated_sources')::int <> 1 THEN
    RAISE EXCEPTION 'forventet updated_sources=1 på re-upsert, fikk %', r;
  END IF;

  IF (r ->> 'status') <> 'candidate' THEN
    RAISE EXCEPTION 'forventet status candidate, fikk %', r ->> 'status';
  END IF;

  r := public.set_action_cluster_verdict(
    v_action_key,
    'below_threshold',
    jsonb_build_array('under_terskel', 'test')
  );

  IF coalesce(r ->> 'ok', 'false') <> 'true' THEN
    RAISE EXCEPTION 'set_action_cluster_verdict feilet: %', r;
  END IF;

  r := public.upsert_action_capture(
    jsonb_build_object('action_key', v_action_key),
    '[]'::jsonb
  );

  IF (r ->> 'status') <> 'below_threshold' THEN
    RAISE EXCEPTION 'capture uten status skal beholde verdict-status, fikk %', r ->> 'status';
  END IF;

  r := public.upsert_action_capture(
    jsonb_build_object('action_key', v_action_key, 'status', 'would_draft'),
    '[]'::jsonb
  );

  IF (r ->> 'status') <> 'would_draft' THEN
    RAISE EXCEPTION 'capture med status skal oppdatere ulåst klynge, fikk %', r ->> 'status';
  END IF;

  UPDATE public.action_clusters
  SET status = 'drafted'
  WHERE action_key = v_action_key;

  r := public.upsert_action_capture(
    jsonb_build_object('action_key', v_action_key, 'status', 'candidate'),
    '[]'::jsonb
  );

  IF (r ->> 'status') <> 'drafted' THEN
    RAISE EXCEPTION 'låst drafted-status skal ikke overskrives, fikk %', r ->> 'status';
  END IF;

  r := public.set_action_cluster_verdict(v_action_key, 'rejected', '[]'::jsonb);
  IF coalesce(r ->> 'ok', 'false') = 'true' THEN
    RAISE EXCEPTION 'forventet status_locked på drafted klynge';
  END IF;
  IF r ->> 'error' <> 'status_locked' THEN
    RAISE EXCEPTION 'forventet error status_locked, fikk %', r;
  END IF;

  DELETE FROM public.action_clusters WHERE action_key = v_action_key;

  r := public.upsert_action_capture(
    jsonb_build_object('action_key', v_action_key),
    '[]'::jsonb
  );
  IF r ->> 'error' <> 'invalid_action_type' THEN
    RAISE EXCEPTION 'forventet invalid_action_type på tom insert, fikk %', r;
  END IF;

  RAISE NOTICE 'action_capture_rpcs.sql: OK';
END $$;
