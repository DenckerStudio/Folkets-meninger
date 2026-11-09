-- Integrasjonstest for research_topics (CI db-security).
-- Egen fixture-data; ruller tilbake så prod-lignende CI ikke trenger seed.

BEGIN;

DO $test$
DECLARE
  v_fixture_cluster_id uuid := '00000000-0000-4000-8000-000000000301';
  v_fixture_reddit_id text := 'ci0rt0test1';
  v_reddit_signal_id uuid;
  v_topic_id uuid;
  v_request_id text := '00000000-0000-4000-8000-000000000201';
  v_r jsonb;
  v_status text;
BEGIN
  IF to_regclass('public.research_topics') IS NULL THEN
    RAISE EXCEPTION 'research_topics.sql: forventet tabell research_topics';
  END IF;

  IF to_regclass('public.action_clusters') IS NULL THEN
    RAISE EXCEPTION 'research_topics.sql: forventet tabell action_clusters';
  END IF;

  INSERT INTO public.action_clusters (
    id,
    action_key,
    action_type,
    action_name,
    description_nb
  )
  VALUES (
    v_fixture_cluster_id,
    'ci-research-topics-' || v_fixture_cluster_id::text,
    'opprop',
    'CI research topics',
    'Testklynge for research_topics.sql'
  )
  ON CONFLICT (id) DO UPDATE SET
    action_name = EXCLUDED.action_name,
    description_nb = EXCLUDED.description_nb;

  INSERT INTO public.reddit_signals (
    reddit_id,
    subreddit,
    title,
    url,
    posted_at,
    snapshot_at
  )
  VALUES (
    v_fixture_reddit_id,
    'norge',
    'Test tema-brief',
    'https://www.reddit.com/comments/' || v_fixture_reddit_id || '/',
    now(),
    now()
  )
  ON CONFLICT (reddit_id) DO UPDATE SET
    title = EXCLUDED.title,
    url = EXCLUDED.url,
    subreddit = EXCLUDED.subreddit
  RETURNING id INTO v_reddit_signal_id;

  DELETE FROM public.research_topics
  WHERE request_id = v_request_id
     OR reddit_signal_id = v_reddit_signal_id;

  v_r := public.research_topics_request_brief(
    v_request_id,
    'reddit',
    NULL,
    v_reddit_signal_id,
    'Test tema-brief',
    NULL,
    false
  );
  v_topic_id := (v_r ->> 'topic_id')::uuid;
  IF v_topic_id IS NULL THEN
    RAISE EXCEPTION 'research_topics_request_brief feilet: %', v_r;
  END IF;

  v_r := public.n8n_upsert_research_topic_brief(
    v_request_id,
    'running',
    NULL,
    NULL,
    NULL,
    NULL
  );
  IF (v_r ->> 'ok')::boolean IS DISTINCT FROM true
     OR (v_r ->> 'topic_id')::uuid IS DISTINCT FROM v_topic_id
     OR v_r ->> 'status' <> 'running' THEN
    RAISE EXCEPTION 'running upsert feilet: %', v_r;
  END IF;

  v_r := public.n8n_upsert_research_topic_brief(
    '00000000-0000-4000-8000-000000000999',
    'running',
    NULL,
    NULL,
    NULL,
    NULL
  );
  IF v_r <> jsonb_build_object('ok', false, 'code', 'unknown_request') THEN
    RAISE EXCEPTION 'forventet unknown_request, fikk %', v_r;
  END IF;

  v_r := public.n8n_upsert_research_topic_brief(
    v_request_id,
    'bogus',
    NULL,
    NULL,
    NULL,
    NULL
  );
  IF v_r <> jsonb_build_object('ok', false, 'code', 'invalid_status') THEN
    RAISE EXCEPTION 'forventet invalid_status, fikk %', v_r;
  END IF;

  v_r := public.n8n_upsert_research_topic_brief(
    v_request_id,
    'failed',
    'henting_feil',
    NULL,
    NULL,
    NULL
  );
  IF (v_r ->> 'ok')::boolean IS DISTINCT FROM true OR v_r ->> 'status' <> 'failed' THEN
    RAISE EXCEPTION 'failed upsert feilet: %', v_r;
  END IF;

  SELECT error INTO v_status FROM public.research_topics WHERE id = v_topic_id;
  IF v_status <> 'henting_feil' THEN
    RAISE EXCEPTION 'forventet henting_feil lagret, fikk %', v_status;
  END IF;

  v_r := public.n8n_upsert_research_topic_brief(
    v_request_id,
    'failed',
    'random_code',
    NULL,
    NULL,
    NULL
  );
  SELECT error INTO v_status FROM public.research_topics WHERE id = v_topic_id;
  IF v_status <> 'ukjent_feil' THEN
    RAISE EXCEPTION 'forventet ukjent_feil, fikk %', v_status;
  END IF;

  v_r := public.n8n_upsert_research_topic_brief(
    v_request_id,
    'done',
    NULL,
    jsonb_build_object(
      'topic_title', 'Formueskatt',
      'current_rules', jsonb_build_object('items', jsonb_build_array('Regel'), 'note', 'ok'),
      'party_proposals', jsonb_build_object('items', '[]'::jsonb, 'note', 'ingen funnet'),
      'media_coverage', jsonb_build_object('items', '[]'::jsonb, 'note', 'ingen funnet'),
      'polls', jsonb_build_object('items', '[]'::jsonb, 'note', 'ingen funnet'),
      'sources', jsonb_build_object(
        'items',
        jsonb_build_array(
          jsonb_build_object(
            'id', 's1',
            'title', 'NRK',
            'url', 'https://www.nrk.no/sak',
            'publisher', 'nrk.no',
            'grade', 'A'
          )
        ),
        'note', 'ok'
      ),
      'generated_at', now()
    ),
    false,
    'mangler kilde utenom Reddit'
  );

  SELECT status INTO v_status FROM public.research_topics WHERE id = v_topic_id;
  IF v_status <> 'done' THEN
    RAISE EXCEPTION 'forventet status done, fikk %', v_status;
  END IF;

  v_r := public.n8n_get_research_topic(v_topic_id);
  IF (v_r ->> 'ok')::boolean IS DISTINCT FROM true
     OR (v_r -> 'topic' ->> 'id')::uuid IS DISTINCT FROM v_topic_id THEN
    RAISE EXCEPTION 'n8n_get_research_topic feilet: %', v_r;
  END IF;

  v_r := public.n8n_get_research_topic('00000000-0000-4000-8000-000000000888'::uuid);
  IF v_r <> jsonb_build_object('ok', false, 'code', 'not_found') THEN
    RAISE EXCEPTION 'forventet not_found fra get, fikk %', v_r;
  END IF;

  v_r := public.research_topics_request_brief(
    v_request_id,
    'reddit',
    NULL,
    v_reddit_signal_id,
    'Test tema-brief',
    NULL,
    false
  );
  IF (v_r ->> 'enqueue')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'forventet enqueue=false for eksisterende brief';
  END IF;

  RAISE NOTICE 'research_topics.sql: OK';
END;
$test$;

ROLLBACK;
