-- Regenereringskø: reject → flagg → n8n upsert nuller → neste manglende sak prioriteres.
DO $$
DECLARE
  v_issue_a text := 'cf-regen-test-a';
  v_issue_b text := 'cf-regen-test-b';
  v_pick text;
  v_flag timestamptz;
BEGIN
  IF to_regclass('public.issue_ai_summaries') IS NULL THEN
    RAISE NOTICE 'issue_ai_summary_regeneration.sql: hopper over';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'admin_submit_content_feedback'
  ) THEN
    RAISE NOTICE 'issue_ai_summary_regeneration.sql: admin_submit_content_feedback mangler';
    RETURN;
  END IF;

  INSERT INTO public.stortinget_issues (id, title, status, first_seen_at, last_synced_at)
  VALUES
    (v_issue_a, 'Regen test A', 'pending', now(), now()),
    (v_issue_b, 'Regen test B', 'pending', now(), now())
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

  DELETE FROM public.issue_ai_summaries
  WHERE stortinget_issue_id IN (v_issue_a, v_issue_b);

  INSERT INTO public.issue_ai_summaries (stortinget_issue_id, hva, hvem, kostnad, narrative, who_affected, how_affected)
  VALUES (
    v_issue_a,
    repeat('x', 200),
    'Test',
    'Test',
    repeat('x', 200),
    'Test',
    'Test'
  );

  PERFORM public.admin_submit_content_feedback(
    'ai_summary',
    v_issue_a,
    'reject',
    '{}'::jsonb,
    ARRAY['for_gammel']::text[],
    NULL,
    NULL,
    '{"title":"Regen test A"}'::jsonb
  );

  SELECT regeneration_requested_at INTO v_flag
  FROM public.issue_ai_summaries
  WHERE stortinget_issue_id = v_issue_a;

  IF v_flag IS NULL THEN
    RAISE EXCEPTION 'forventet regeneration_requested_at etter reject';
  END IF;

  SELECT id INTO v_pick
  FROM public.n8n_list_issues_missing_ai_summary(1)
  LIMIT 1;

  IF v_pick <> v_issue_b THEN
    RAISE EXCEPTION 'forventet issue uten sammendrag (%) før regenereringskø (%), fikk %', v_issue_b, v_issue_a, v_pick;
  END IF;

  PERFORM public.n8n_upsert_issue_ai_summary(
    v_issue_a,
    repeat('y', 200),
    'Test',
    'Test',
    repeat('y', 200),
    'Test',
    'Test'
  );

  SELECT regeneration_requested_at INTO v_flag
  FROM public.issue_ai_summaries
  WHERE stortinget_issue_id = v_issue_a;

  IF v_flag IS NOT NULL THEN
    RAISE EXCEPTION 'forventet regeneration_requested_at null etter n8n upsert';
  END IF;

  SELECT id INTO v_pick
  FROM public.n8n_list_issues_missing_ai_summary(1)
  LIMIT 1;

  IF v_pick IS DISTINCT FROM v_issue_b THEN
    RAISE EXCEPTION 'etter upsert skal manglende sak B prioriteres, fikk %', v_pick;
  END IF;

  DELETE FROM public.content_feedback
  WHERE content_type = 'ai_summary' AND content_id = v_issue_a;

  DELETE FROM public.issue_ai_summaries
  WHERE stortinget_issue_id IN (v_issue_a, v_issue_b);

  DELETE FROM public.stortinget_issues WHERE id IN (v_issue_a, v_issue_b);

  -- Backoff: nylig forsøk på A skal ikke blokkere regenerering av B
  v_issue_a := 'cf-regen-backoff-a';
  v_issue_b := 'cf-regen-backoff-b';

  INSERT INTO public.stortinget_issues (id, title, status, first_seen_at, last_synced_at)
  VALUES
    (v_issue_a, 'Backoff A', 'pending', now(), now()),
    (v_issue_b, 'Backoff B', 'pending', now(), now())
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

  DELETE FROM public.issue_ai_summaries
  WHERE stortinget_issue_id IN (v_issue_a, v_issue_b);

  INSERT INTO public.issue_ai_summaries (
    stortinget_issue_id, hva, hvem, kostnad, narrative, who_affected, how_affected,
    regeneration_requested_at, regeneration_attempts, regeneration_last_attempt_at
  )
  VALUES
    (
      v_issue_a,
      repeat('x', 200), 'Test', 'Test', repeat('x', 200), 'Test', 'Test',
      now(), 1, now()
    ),
    (
      v_issue_b,
      repeat('y', 200), 'Test', 'Test', repeat('y', 200), 'Test', 'Test',
      now() - interval '1 hour', 0, NULL
    );

  SELECT q.id INTO v_pick
  FROM public.n8n_list_issues_missing_ai_summary(200) q
  WHERE q.id IN (v_issue_a, v_issue_b)
  LIMIT 1;

  IF v_pick IS DISTINCT FROM v_issue_b THEN
    RAISE EXCEPTION 'backoff: forventet B (%) før A i køen, fikk %', v_issue_b, v_pick;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.n8n_list_issues_missing_ai_summary(200) q
    WHERE q.id = v_issue_a
  ) THEN
    RAISE EXCEPTION 'backoff: A skal være utelatt mens last_attempt er innen 15 min';
  END IF;

  DELETE FROM public.issue_ai_summaries
  WHERE stortinget_issue_id IN (v_issue_a, v_issue_b);
  DELETE FROM public.stortinget_issues WHERE id IN (v_issue_a, v_issue_b);

  -- Claim øker regeneration_attempts atomisk
  v_issue_a := 'cf-regen-claim-a';
  v_issue_b := 'cf-regen-claim-b';

  INSERT INTO public.stortinget_issues (id, title, status, first_seen_at, last_synced_at)
  VALUES
    (v_issue_a, 'Claim A', 'pending', now(), now()),
    (v_issue_b, 'Claim B', 'pending', now(), now())
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

  DELETE FROM public.issue_ai_summaries
  WHERE stortinget_issue_id IN (v_issue_a, v_issue_b);

  INSERT INTO public.issue_ai_summaries (
    stortinget_issue_id, hva, hvem, kostnad, narrative, who_affected, how_affected,
    regeneration_requested_at, regeneration_attempts, regeneration_last_attempt_at
  )
  VALUES
    (
      v_issue_a,
      repeat('x', 200), 'Test', 'Test', repeat('x', 200), 'Test', 'Test',
      now() - interval '2 hours', 0, NULL
    ),
    (
      v_issue_b,
      repeat('y', 200), 'Test', 'Test', repeat('y', 200), 'Test', 'Test',
      now() - interval '3 hours', 0, NULL
    );

  UPDATE public.issue_ai_summaries
  SET regeneration_last_attempt_at = now() - interval '20 minutes'
  WHERE stortinget_issue_id = v_issue_a;

  SELECT q.id INTO v_pick
  FROM public.n8n_list_issues_missing_ai_summary(1) q;

  IF v_pick IS DISTINCT FROM v_issue_b THEN
    RAISE EXCEPTION 'claim: forventet B (%), fikk %', v_issue_b, v_pick;
  END IF;

  IF (
    SELECT regeneration_attempts FROM public.issue_ai_summaries WHERE stortinget_issue_id = v_issue_b
  ) <> 1 THEN
    RAISE EXCEPTION 'claim: forventet regeneration_attempts=1 på B';
  END IF;

  DELETE FROM public.issue_ai_summaries
  WHERE stortinget_issue_id IN (v_issue_a, v_issue_b);
  DELETE FROM public.stortinget_issues WHERE id IN (v_issue_a, v_issue_b);
END;
$$;
