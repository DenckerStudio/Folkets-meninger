-- Integrasjonstest: view public.reddit_learning_stats og tilganger.

DO $$
DECLARE
  v_i int;
  v_brukt_rate numeric;
  v_topic_rate numeric;
  v_count int;
BEGIN
  IF to_regclass('public.reddit_learning_stats') IS NULL THEN
    RAISE EXCEPTION 'reddit_learning_stats.sql: forventer migrasjon 20261116200000_reddit_learning_stats.sql';
  END IF;

  IF has_table_privilege('anon', 'public.reddit_learning_stats', 'SELECT') THEN
    RAISE EXCEPTION 'anon skal ikke ha SELECT på reddit_learning_stats';
  END IF;
  IF has_table_privilege('authenticated', 'public.reddit_learning_stats', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated skal ikke ha SELECT på reddit_learning_stats';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.reddit_learning_stats', 'SELECT') THEN
    RAISE EXCEPTION 'service_role mangler SELECT på reddit_learning_stats';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'reddit_learning_stats'
      AND c.relkind = 'v'
      AND coalesce(c.reloptions::text[] && ARRAY['security_invoker=true', 'security_invoker=on'], false)
  ) THEN
    RAISE EXCEPTION 'reddit_learning_stats skal ha security_invoker = true';
  END IF;

  SET LOCAL ROLE service_role;

  FOR v_i IN 1..6 LOOP
    INSERT INTO public.reddit_signals (
      reddit_id,
      subreddit,
      title,
      url,
      score,
      num_comments,
      contention,
      posted_at,
      snapshot_at,
      topic,
      link_domain,
      status,
      ai_relevance
    )
    VALUES (
      'lrnstat' || v_i::text,
      'norge',
      'Læringstest ' || v_i::text,
      'https://www.reddit.com/comments/lrnstat' || v_i::text || '/',
      10 + v_i,
      2,
      0.1,
      now(),
      now(),
      'skatt',
      'nrk.no',
      CASE WHEN v_i <= 2 THEN 'brukt' ELSE 'ny' END,
      4
    );
  END LOOP;

  SELECT count(*) INTO v_count
  FROM public.reddit_learning_stats
  WHERE dimension = 'subreddit' AND group_key = 'norge';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'forventet én subreddit-rad for norge (n=6), fant %', v_count;
  END IF;

  SELECT brukt_rate INTO v_brukt_rate
  FROM public.reddit_learning_stats
  WHERE dimension = 'subreddit' AND group_key = 'norge';

  IF v_brukt_rate IS NULL OR abs(v_brukt_rate - (2::numeric / 6::numeric)) > 0.001 THEN
    RAISE EXCEPTION 'subreddit brukt_rate forventet ~0.333, fikk %', v_brukt_rate;
  END IF;

  SELECT brukt_rate INTO v_topic_rate
  FROM public.reddit_learning_stats
  WHERE dimension = 'topic' AND group_key = 'skatt';

  IF v_topic_rate IS NULL OR abs(v_topic_rate - (2::numeric / 6::numeric)) > 0.001 THEN
    RAISE EXCEPTION 'topic brukt_rate forventet ~0.333, fikk %', v_topic_rate;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reddit_learning_stats
    WHERE dimension = 'subreddit' AND total < 5
  ) THEN
    RAISE EXCEPTION 'view skal ikke eksponere grupper med total < 5';
  END IF;

  IF to_regclass('public.reddit_cluster_stats') IS NULL THEN
    RAISE EXCEPTION 'forventer view reddit_cluster_stats';
  END IF;

  IF has_table_privilege('anon', 'public.reddit_cluster_stats', 'SELECT') THEN
    RAISE EXCEPTION 'anon skal ikke ha SELECT på reddit_cluster_stats';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.reddit_cluster_stats', 'SELECT') THEN
    RAISE EXCEPTION 'service_role mangler SELECT på reddit_cluster_stats';
  END IF;

  UPDATE public.reddit_signals
  SET cluster_id = 'lrn-cluster-a'
  WHERE reddit_id IN ('lrnstat1', 'lrnstat2', 'lrnstat3');

  IF (SELECT post_count FROM public.reddit_cluster_stats WHERE cluster_id = 'lrn-cluster-a') <> 3 THEN
    RAISE EXCEPTION 'reddit_cluster_stats post_count forventet 3';
  END IF;

  IF (SELECT total_clusters FROM public.reddit_cluster_meta) < 1 THEN
    RAISE EXCEPTION 'reddit_cluster_meta total_clusters forventet >= 1';
  END IF;

  DELETE FROM public.reddit_signals WHERE reddit_id LIKE 'lrnstat%';
END $$;