-- Integrasjonstest: reddit_signals v2, blokkliste, snapshots, status (CI db-security).
-- pgTAP-stil via DO-blokker (samme mønster som øvrige supabase/tests).

DO $$
DECLARE
  v_blocklisted text := '1xxcxb7';
  v_fixture_reddit_id text := 'civ2sig0001';
  v_other_id text := 'civ2sig0002';
  v_signal_id uuid;
  v_r jsonb;
  v_status text;
  v_count int;
  v_topic_id uuid;
  v_reason text;
  v_request_id text := '00000000-0000-4000-8000-000000000701';
BEGIN
  IF to_regclass('public.reddit_blocklist') IS NULL THEN
    RAISE EXCEPTION 'reddit_signals_v2.sql: forventer migrasjon 20261116170000_reddit_signals_v2.sql';
  END IF;

  IF has_table_privilege('anon', 'public.reddit_signals', 'SELECT') THEN
    RAISE EXCEPTION 'anon skal ikke ha SELECT på reddit_signals';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.n8n_upsert_reddit_signals(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role mangler EXECUTE på n8n_upsert_reddit_signals';
  END IF;
  IF has_function_privilege('anon', 'public.n8n_upsert_reddit_signals(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon skal ikke ha EXECUTE på n8n_upsert_reddit_signals';
  END IF;

  SET LOCAL ROLE service_role;

  v_r := public.n8n_upsert_reddit_signals(
    jsonb_build_array(
      jsonb_build_object(
        'reddit_id', v_blocklisted,
        'subreddit', 'norge',
        'title', 'Skal blokkeres',
        'posted_at', now(),
        'snapshot_at', now()
      )
    )
  );
  IF (v_r ->> 'inserted')::int <> 0 OR (v_r ->> 'updated')::int <> 0 THEN
    RAISE EXCEPTION 'blocklist: forventet ingen insert/update, fikk %', v_r;
  END IF;
  IF jsonb_array_length(v_r -> 'blocked') <> 1
     OR v_r -> 'blocked' -> 0 ->> 'reddit_id' <> v_blocklisted THEN
    RAISE EXCEPTION 'blocklist: forventet blocked-array, fikk %', v_r;
  END IF;
  IF EXISTS (SELECT 1 FROM public.reddit_signals WHERE reddit_id = v_blocklisted) THEN
    RAISE EXCEPTION 'blocklist: rad ble opprettet likevel';
  END IF;

  v_r := public.n8n_upsert_reddit_signals(
    jsonb_build_array(
      jsonb_build_object(
        'reddit_id', v_fixture_reddit_id,
        'subreddit', 'norge',
        'title', 'CI v2 upsert',
        'score', 10,
        'num_comments', 3,
        'upvote_ratio', 0.91,
        'num_crossposts', 1,
        'posted_at', now(),
        'snapshot_at', now()
      )
    )
  );
  IF (v_r ->> 'inserted')::int <> 1 AND (v_r ->> 'updated')::int <> 1 THEN
    RAISE EXCEPTION 'upsert feilet: %', v_r;
  END IF;

  SELECT id, status INTO v_signal_id, v_status
  FROM public.reddit_signals
  WHERE reddit_id = v_fixture_reddit_id;

  IF v_status IS DISTINCT FROM 'ny' THEN
    RAISE EXCEPTION 'ny insert: forventet status ny, fikk %', v_status;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.reddit_signal_snapshots
  WHERE signal_id = v_signal_id;
  IF v_count < 1 THEN
    RAISE EXCEPTION 'snapshot: forventet minst én rad, fikk %', v_count;
  END IF;

  UPDATE public.reddit_signals
  SET status = 'ignorert', status_reason = 'ci-test'
  WHERE id = v_signal_id;

  v_r := public.n8n_upsert_reddit_signals(
    jsonb_build_array(
      jsonb_build_object(
        'reddit_id', v_fixture_reddit_id,
        'subreddit', 'norge',
        'title', 'CI v2 re-upsert',
        'score', 11,
        'num_comments', 4,
        'posted_at', now(),
        'snapshot_at', now()
      )
    )
  );
  IF (v_r ->> 'updated')::int < 1 THEN
    RAISE EXCEPTION 're-upsert: forventet updated >= 1, fikk %', v_r;
  END IF;

  SELECT status INTO v_status FROM public.reddit_signals WHERE id = v_signal_id;
  IF v_status <> 'ignorert' THEN
    RAISE EXCEPTION 'status: RPC skal ikke overskrive administrativ status, fikk %', v_status;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.reddit_signal_snapshots
  WHERE signal_id = v_signal_id;
  IF v_count < 2 THEN
    RAISE EXCEPTION 'snapshot: forventet andre rad etter re-upsert, count=%', v_count;
  END IF;

  INSERT INTO public.reddit_signals (
    reddit_id,
    subreddit,
    title,
    url,
    posted_at,
    snapshot_at,
    status
  )
  VALUES (
    v_other_id,
    'norge',
    'Trigger-test',
    'https://www.reddit.com/comments/' || v_other_id || '/',
    now(),
    now(),
    'ny'
  )
  ON CONFLICT (reddit_id) DO UPDATE SET status = 'ny'
  RETURNING id INTO v_signal_id;

  DELETE FROM public.research_topics WHERE request_id = v_request_id;

  v_r := public.research_topics_request_brief(
    v_request_id,
    'reddit',
    NULL,
    v_signal_id,
    'Trigger-test tema',
    NULL,
    false
  );
  v_topic_id := (v_r ->> 'topic_id')::uuid;
  IF v_topic_id IS NULL THEN
    RAISE EXCEPTION 'research_topics_request_brief feilet: %', v_r;
  END IF;

  SELECT status, status_reason INTO v_status, v_reason
  FROM public.reddit_signals
  WHERE id = v_signal_id;
  IF v_status <> 'brukt' OR v_status IS NULL THEN
    RAISE EXCEPTION 'trigger: forventet status brukt, fikk %', v_status;
  END IF;
  IF v_reason <> 'research_topic_opprettet' THEN
    RAISE EXCEPTION 'trigger: uventet status_reason: %', v_reason;
  END IF;

  DELETE FROM public.research_topics WHERE id = v_topic_id;
END;
$$;

DO $$
DECLARE
  v_reddit_id text := 'civ2clsc01';
  v_r jsonb;
  v_matured timestamptz := '2026-11-01T12:00:00Z'::timestamptz;
  v_scored timestamptz := '2026-11-02T14:00:00Z'::timestamptz;
  v_matured2 timestamptz := '2026-11-10T08:00:00Z'::timestamptz;
BEGIN
  SET LOCAL ROLE service_role;

  v_r := public.n8n_upsert_reddit_signals(
    jsonb_build_array(
      jsonb_build_object(
        'reddit_id', v_reddit_id,
        'subreddit', 'norge',
        'title', 'Coalesce seed',
        'score', 5,
        'num_comments', 1,
        'upvote_ratio', 0.88,
        'num_crossposts', 2,
        'crosspost_parent', 'parent-a',
        'link_domain', 'example.com',
        'link_url_canonical', 'https://example.com/a',
        'flair', 'Politikk',
        'removal_type', 'none',
        'matured_at', v_matured,
        'ai_relevance', 4,
        'ai_reason', 'seed-reason',
        'ai_model', 'ci-model-v1',
        'ai_scored_at', v_scored,
        'cluster_id', 'cluster-seed',
        'posted_at', now(),
        'snapshot_at', now()
      )
    )
  );
  IF (v_r ->> 'inserted')::int < 1 AND (v_r ->> 'updated')::int < 1 THEN
    RAISE EXCEPTION 'coalesce seed upsert feilet: %', v_r;
  END IF;

  v_r := public.n8n_upsert_reddit_signals(
    jsonb_build_array(
      jsonb_build_object(
        'reddit_id', v_reddit_id,
        'subreddit', 'norge',
        'title', 'Coalesce re-upsert uten valgfrie felt',
        'score', 6,
        'num_comments', 2,
        'posted_at', now(),
        'snapshot_at', now()
      )
    )
  );
  IF (v_r ->> 'updated')::int < 1 THEN
    RAISE EXCEPTION 'coalesce re-upsert: forventet updated, fikk %', v_r;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.reddit_signals rs
    WHERE rs.reddit_id = v_reddit_id
      AND rs.upvote_ratio = 0.88
      AND rs.num_crossposts = 2
      AND rs.crosspost_parent = 'parent-a'
      AND rs.link_domain = 'example.com'
      AND rs.link_url_canonical = 'https://example.com/a'
      AND rs.flair = 'Politikk'
      AND rs.removal_type = 'none'
      AND rs.matured_at = v_matured
      AND rs.ai_relevance = 4
      AND rs.ai_reason = 'seed-reason'
      AND rs.ai_model = 'ci-model-v1'
      AND rs.ai_scored_at = v_scored
      AND rs.cluster_id = 'cluster-seed'
  ) THEN
    RAISE EXCEPTION 'coalesce: valgfrie felt ble nullstilt ved re-upsert uten payload';
  END IF;

  v_r := public.n8n_upsert_reddit_signals(
    jsonb_build_array(
      jsonb_build_object(
        'reddit_id', v_reddit_id,
        'subreddit', 'norge',
        'title', 'Coalesce override',
        'score', 7,
        'num_comments', 3,
        'ai_relevance', 5,
        'ai_reason', 'override-reason',
        'ai_model', 'ci-model-v2',
        'cluster_id', 'cluster-override',
        'matured_at', v_matured2,
        'posted_at', now(),
        'snapshot_at', now()
      )
    )
  );
  IF (v_r ->> 'updated')::int < 1 THEN
    RAISE EXCEPTION 'coalesce override upsert: forventet updated, fikk %', v_r;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.reddit_signals rs
    WHERE rs.reddit_id = v_reddit_id
      AND rs.ai_relevance = 5
      AND rs.ai_reason = 'override-reason'
      AND rs.ai_model = 'ci-model-v2'
      AND rs.cluster_id = 'cluster-override'
      AND rs.matured_at = v_matured2
      AND rs.upvote_ratio = 0.88
      AND rs.link_domain = 'example.com'
  ) THEN
    RAISE EXCEPTION 'coalesce: nye AI-felt ble ikke lagret eller andre felt ble feilaktig nullstilt';
  END IF;
END;
$$;