-- Atomisitet: ugyldig kilde sist i array skal ikke etterlate rader.
DO $$
DECLARE
  v_action_key text := 'test:cursor-action-capture-atomic';
  v_clusters_before bigint;
  v_sources_before bigint;
  v_clusters_after bigint;
  v_sources_after bigint;
BEGIN
  IF to_regclass('public.action_clusters') IS NULL THEN
    RAISE NOTICE 'action_capture_atomic.sql: hopper over (tabeller finnes ikke)';
    RETURN;
  END IF;

  IF to_regprocedure('public.upsert_action_capture(jsonb,jsonb)') IS NULL THEN
    RAISE NOTICE 'action_capture_atomic.sql: hopper over (RPC finnes ikke)';
    RETURN;
  END IF;

  DELETE FROM public.action_clusters WHERE action_key = v_action_key;

  SELECT count(*) INTO v_clusters_before FROM public.action_clusters;
  SELECT count(*) INTO v_sources_before FROM public.action_sources;

  BEGIN
    PERFORM public.upsert_action_capture(
      jsonb_build_object(
        'action_key', v_action_key,
        'action_type', 'opprop',
        'action_name', 'Atomisitetstest',
        'description_nb', 'Skal rulle tilbake ved ugyldig kilde sist'
      ),
      jsonb_build_array(
        jsonb_build_object(
          'item_key', 'news_rss:https://example.com/atomic-ok',
          'url_canonical', 'https://example.com/atomic-ok',
          'source_type', 'news_rss'
        ),
        jsonb_build_object(
          'item_key', 'bad:missing-url',
          'source_type', 'news_rss'
        )
      )
    );
    RAISE EXCEPTION 'forventet exception ved ugyldig kilde sist';
  EXCEPTION
    WHEN sqlstate '22023' THEN
      NULL;
  END;

  SELECT count(*) INTO v_clusters_after FROM public.action_clusters;
  SELECT count(*) INTO v_sources_after FROM public.action_sources;

  IF v_clusters_after <> v_clusters_before THEN
    RAISE EXCEPTION 'action_clusters endret etter feilet upsert (% -> %)', v_clusters_before, v_clusters_after;
  END IF;

  IF v_sources_after <> v_sources_before THEN
    RAISE EXCEPTION 'action_sources endret etter feilet upsert (% -> %)', v_sources_before, v_sources_after;
  END IF;

  IF EXISTS (SELECT 1 FROM public.action_clusters WHERE action_key = v_action_key) THEN
    RAISE EXCEPTION 'test action_key ble opprettet etter feilet upsert';
  END IF;

  -- Idempotent suksess: to like kall gir stabil rad og updated_sources på re-upsert
  PERFORM public.upsert_action_capture(
    jsonb_build_object(
      'action_key', v_action_key,
      'action_type', 'opprop',
      'action_name', 'Atomisitetstest',
      'description_nb', 'Gyldig klynge'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'item_key', 'news_rss:https://example.com/atomic-ok',
        'url_canonical', 'https://example.com/atomic-ok',
        'source_type', 'news_rss'
      )
    )
  );

  PERFORM public.upsert_action_capture(
    jsonb_build_object('action_key', v_action_key),
    jsonb_build_array(
      jsonb_build_object(
        'item_key', 'news_rss:https://example.com/atomic-ok',
        'url_canonical', 'https://example.com/atomic-ok',
        'source_type', 'news_rss'
      )
    )
  );

  DELETE FROM public.action_clusters WHERE action_key = v_action_key;

  RAISE NOTICE 'action_capture_atomic.sql: OK';
END $$;

-- JSON null / manglende felt: ikke overskriv lagrede verdier (best_scale, kilde-felt).
DO $$
DECLARE
  v_action_key text := 'test:cursor-action-capture-merge-null';
  v_scale jsonb := jsonb_build_object('value', 99, 'unit', 'stk');
  v_title text;
  v_sig boolean;
  v_first_seen timestamptz;
  v_publishers text[];
  v_max_conf numeric;
BEGIN
  IF to_regprocedure('public.upsert_action_capture(jsonb,jsonb)') IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.action_clusters WHERE action_key = v_action_key;

  PERFORM public.upsert_action_capture(
    jsonb_build_object(
      'action_key', v_action_key,
      'action_type', 'opprop',
      'action_name', 'Null-test',
      'description_nb', 'Beskrivelse',
      'best_scale', v_scale,
      'first_seen_at', '2020-01-01T00:00:00Z'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'item_key', 'news_rss:https://example.com/null-a',
        'url_canonical', 'https://example.com/null-a',
        'source_type', 'news_rss',
        'publisher', 'nrk.no',
        'title', 'Behold tittel',
        'confidence', 0.4,
        'signal_only', false
      ),
      jsonb_build_object(
        'item_key', 'reddit:t3_signal',
        'url_canonical', 'https://reddit.com/r/x/comments/abc',
        'source_type', 'reddit',
        'publisher', 'reddit.com',
        'record_kind', 'signal',
        'confidence', 0.9
      )
    )
  );

  PERFORM public.upsert_action_capture(
    jsonb_build_object('action_key', v_action_key, 'best_scale', jsonb_null),
    jsonb_build_array(
      jsonb_build_object(
        'item_key', 'news_rss:https://example.com/null-a',
        'url_canonical', 'https://example.com/null-a',
        'source_type', 'news_rss'
      )
    )
  );

  SELECT best_scale INTO v_scale FROM public.action_clusters WHERE action_key = v_action_key;
  IF v_scale IS NULL OR (v_scale ->> 'value')::int <> 99 THEN
    RAISE EXCEPTION 'best_scale skulle ikke nullstilles av json null, fikk %', v_scale;
  END IF;

  SELECT title INTO v_title
  FROM public.action_sources
  WHERE item_key = 'news_rss:https://example.com/null-a';

  IF v_title IS DISTINCT FROM 'Behold tittel' THEN
    RAISE EXCEPTION 'kilde-tittel skulle bevares ved delvis upsert, fikk %', v_title;
  END IF;

  SELECT signal_only INTO v_sig FROM public.action_sources WHERE item_key = 'reddit:t3_signal';
  IF v_sig IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'record_kind=signal skal sette signal_only=true';
  END IF;

  SELECT independent_publishers, max_confidence
  INTO v_publishers, v_max_conf
  FROM public.action_clusters
  WHERE action_key = v_action_key;

  IF v_publishers IS NULL OR NOT ('nrk.no' = ANY (v_publishers)) OR array_length(v_publishers, 1) <> 1 THEN
    RAISE EXCEPTION 'independent_publishers skal kun telle ikke-signal kilder, fikk %', v_publishers;
  END IF;

  IF v_max_conf IS NULL OR v_max_conf <> 0.9 THEN
    RAISE EXCEPTION 'max_confidence skal være max fra kilder (0.9), fikk %', v_max_conf;
  END IF;

  SELECT first_seen_at INTO v_first_seen FROM public.action_clusters WHERE action_key = v_action_key;
  IF v_first_seen::date <> date '2020-01-01' THEN
    RAISE EXCEPTION 'first_seen_at fra insert skulle være 2020-01-01, fikk %', v_first_seen;
  END IF;

  PERFORM public.upsert_action_capture(
    jsonb_build_object(
      'action_key', v_action_key,
      'first_seen_at', '2019-06-01T12:00:00Z'
    ),
    '[]'::jsonb
  );

  SELECT first_seen_at INTO v_first_seen FROM public.action_clusters WHERE action_key = v_action_key;
  IF v_first_seen::date <> date '2019-06-01' THEN
    RAISE EXCEPTION 'first_seen_at skulle LEAST til 2019-06-01, fikk %', v_first_seen;
  END IF;

  DELETE FROM public.action_clusters WHERE action_key = v_action_key;
  RAISE NOTICE 'action_capture_atomic.sql: merge/null OK';
END $$;
