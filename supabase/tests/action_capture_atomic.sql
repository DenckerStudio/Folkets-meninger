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
    jsonb_build_object('action_key', v_action_key, 'best_scale', 'null'::jsonb),
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

-- metadata merge beholder eksisterende nøkler; metadata uten is_signal endrer ikke signal_only.
DO $$
DECLARE
  v_action_key text := 'test:cursor-action-capture-metadata-signal';
  v_meta jsonb;
  v_sig boolean;
BEGIN
  IF to_regprocedure('public.upsert_action_capture(jsonb,jsonb)') IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.action_clusters WHERE action_key = v_action_key;

  PERFORM public.upsert_action_capture(
    jsonb_build_object(
      'action_key', v_action_key,
      'action_type', 'opprop',
      'action_name', 'Meta-test',
      'description_nb', 'Beskrivelse',
      'metadata', jsonb_build_object('behold', 'ja', 'versjon', 1)
    ),
    jsonb_build_array(
      jsonb_build_object(
        'item_key', 'news_rss:https://example.com/meta-sig',
        'url_canonical', 'https://example.com/meta-sig',
        'source_type', 'news_rss',
        'signal_only', true,
        'title', 'Opprinnelig tittel'
      )
    )
  );

  PERFORM public.upsert_action_capture(
    jsonb_build_object(
      'action_key', v_action_key,
      'metadata', jsonb_build_object('ny', 'felt')
    ),
    jsonb_build_array(
      jsonb_build_object(
        'item_key', 'news_rss:https://example.com/meta-sig',
        'url_canonical', 'https://example.com/meta-sig',
        'source_type', 'news_rss',
        'metadata', jsonb_build_object('note', 'uten is_signal')
      )
    )
  );

  SELECT metadata INTO v_meta FROM public.action_clusters WHERE action_key = v_action_key;
  IF v_meta ->> 'behold' IS DISTINCT FROM 'ja' OR v_meta ->> 'versjon' IS DISTINCT FROM '1' OR v_meta ->> 'ny' IS DISTINCT FROM 'felt' THEN
    RAISE EXCEPTION 'metadata merge feilet, fikk %', v_meta;
  END IF;

  SELECT signal_only INTO v_sig FROM public.action_sources WHERE item_key = 'news_rss:https://example.com/meta-sig';
  IF v_sig IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'signal_only skulle ikke nullstilles av metadata uten is_signal';
  END IF;

  PERFORM public.upsert_action_capture(
    jsonb_build_object('action_key', v_action_key),
    jsonb_build_array(
      jsonb_build_object(
        'item_key', 'news_rss:https://example.com/meta-sig',
        'url_canonical', 'https://example.com/meta-sig',
        'source_type', 'news_rss',
        'title', ''
      )
    )
  );

  IF (SELECT title FROM public.action_sources WHERE item_key = 'news_rss:https://example.com/meta-sig')
    IS DISTINCT FROM 'Opprinnelig tittel' THEN
    RAISE EXCEPTION 'tom tittel-streng skulle ikke slette lagret tittel';
  END IF;

  DELETE FROM public.action_clusters WHERE action_key = v_action_key;
  RAISE NOTICE 'action_capture_atomic.sql: metadata/signal_only OK';
END $$;

-- Flytting av kilde til annen klynge: gammel klynge får oppdatert independent_publishers.
DO $$
DECLARE
  v_key_a text := 'test:cursor-action-capture-move-a';
  v_key_b text := 'test:cursor-action-capture-move-b';
  v_item text := 'news_rss:https://example.com/move-shared';
  v_id_a uuid;
  v_id_b uuid;
  v_pub_a text[];
BEGIN
  IF to_regprocedure('public.upsert_action_capture(jsonb,jsonb)') IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.action_clusters WHERE action_key IN (v_key_a, v_key_b);

  PERFORM public.upsert_action_capture(
    jsonb_build_object(
      'action_key', v_key_a,
      'action_type', 'opprop',
      'action_name', 'Klynge A',
      'description_nb', 'A'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'item_key', v_item,
        'url_canonical', 'https://example.com/move-shared',
        'source_type', 'news_rss',
        'publisher', 'vg.no',
        'signal_only', false,
        'confidence', 0.5
      )
    )
  );

  PERFORM public.upsert_action_capture(
    jsonb_build_object(
      'action_key', v_key_b,
      'action_type', 'opprop',
      'action_name', 'Klynge B',
      'description_nb', 'B'
    ),
    '[]'::jsonb
  );

  SELECT id INTO v_id_a FROM public.action_clusters WHERE action_key = v_key_a;
  SELECT id INTO v_id_b FROM public.action_clusters WHERE action_key = v_key_b;

  PERFORM public.upsert_action_capture(
    jsonb_build_object('action_key', v_key_b),
    jsonb_build_array(
      jsonb_build_object(
        'item_key', v_item,
        'url_canonical', 'https://example.com/move-shared',
        'source_type', 'news_rss',
        'publisher', 'vg.no',
        'signal_only', false,
        'confidence', 0.5
      )
    )
  );

  SELECT independent_publishers INTO v_pub_a FROM public.action_clusters WHERE id = v_id_a;
  IF v_pub_a IS NOT NULL AND array_length(v_pub_a, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'klynge A skulle miste vg.no etter flytt, fikk %', v_pub_a;
  END IF;

  IF (SELECT cluster_id FROM public.action_sources WHERE item_key = v_item) IS DISTINCT FROM v_id_b THEN
    RAISE EXCEPTION 'kilde skulle tilhøre klynge B';
  END IF;

  DELETE FROM public.action_clusters WHERE action_key IN (v_key_a, v_key_b);
  RAISE NOTICE 'action_capture_atomic.sql: source move OK';
END $$;

-- Samme action_key: eksisterende rad + upsert (ON CONFLICT DO NOTHING på insert) skal ikke feile.
DO $$
DECLARE
  v_action_key text := 'test:cursor-action-capture-insert-race';
BEGIN
  IF to_regprocedure('public.upsert_action_capture(jsonb,jsonb)') IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.action_clusters WHERE action_key = v_action_key;

  INSERT INTO public.action_clusters (
    action_key,
    action_type,
    action_name,
    description_nb,
    status
  )
  VALUES (v_action_key, 'opprop', 'Eksisterende', 'Fra annen sesjon', 'candidate');

  PERFORM public.upsert_action_capture(
    jsonb_build_object(
      'action_key', v_action_key,
      'action_type', 'opprop',
      'action_name', 'Parallell insert',
      'description_nb', 'Skal falle tilbake til update'
    ),
    '[]'::jsonb
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.action_clusters
    WHERE action_key = v_action_key AND action_name = 'Parallell insert'
  ) THEN
    RAISE EXCEPTION 'upsert etter eksisterende action_key skulle oppdatere klynge';
  END IF;

  DELETE FROM public.action_clusters WHERE action_key = v_action_key;
  RAISE NOTICE 'action_capture_atomic.sql: insert race OK';
END $$;
