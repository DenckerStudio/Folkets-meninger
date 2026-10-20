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
