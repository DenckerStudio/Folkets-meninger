-- SQL smoke for reply_worth RPCs (run manually / in db-security when table exists).

DO $$
DECLARE
  v_has_execute boolean;
  v_result jsonb;
  v_reddit_id text := 'rwtest01';
BEGIN
  IF to_regclass('public.reddit_signals') IS NULL THEN
    RAISE NOTICE 'reddit_signals mangler — hopper over reddit_reply_worth-test';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reddit_signals'
      AND column_name = 'reply_worth'
  ) THEN
    RAISE NOTICE 'reply_worth-kolonne mangler — hopper over (migrasjon ikke applisert)';
    RETURN;
  END IF;

  SELECT has_function_privilege('anon', 'public.n8n_set_reddit_reply_worth(text, text, smallint, text, text, boolean)', 'EXECUTE')
    INTO v_has_execute;
  IF v_has_execute THEN
    RAISE EXCEPTION 'anon skal ikke ha EXECUTE på n8n_set_reddit_reply_worth';
  END IF;

  SELECT has_function_privilege('authenticated', 'public.n8n_set_reddit_reply_worth(text, text, smallint, text, text, boolean)', 'EXECUTE')
    INTO v_has_execute;
  IF v_has_execute THEN
    RAISE EXCEPTION 'authenticated skal ikke ha EXECUTE på n8n_set_reddit_reply_worth';
  END IF;

  SELECT has_function_privilege('service_role', 'public.n8n_set_reddit_reply_worth(text, text, smallint, text, text, boolean)', 'EXECUTE')
    INTO v_has_execute;
  IF NOT v_has_execute THEN
    RAISE EXCEPTION 'service_role mangler EXECUTE på n8n_set_reddit_reply_worth';
  END IF;

  SELECT has_function_privilege('anon', 'public.n8n_list_reddit_reply_worth_candidates(int)', 'EXECUTE')
    INTO v_has_execute;
  IF v_has_execute THEN
    RAISE EXCEPTION 'anon skal ikke ha EXECUTE på n8n_list_reddit_reply_worth_candidates';
  END IF;

  SELECT has_function_privilege('service_role', 'public.n8n_list_reddit_reply_worth_candidates(int)', 'EXECUTE')
    INTO v_has_execute;
  IF NOT v_has_execute THEN
    RAISE EXCEPTION 'service_role mangler EXECUTE på n8n_list_reddit_reply_worth_candidates';
  END IF;

  SET LOCAL ROLE service_role;

  v_result := public.n8n_set_reddit_reply_worth('!!!bad!!!', 'scored', 4, 'x', 'm', true);
  IF coalesce(v_result ->> 'ok', 'true') = 'true' THEN
    RAISE EXCEPTION 'ugyldig reddit_id skulle feile';
  END IF;

  v_result := public.n8n_set_reddit_reply_worth(v_reddit_id, 'scored', 9, 'x', 'm', true);
  IF coalesce(v_result ->> 'error', '') <> 'invalid_worth' THEN
    RAISE EXCEPTION 'worth utenfor 1–5 skulle feile, fikk %', v_result;
  END IF;

  INSERT INTO public.reddit_signals (
    reddit_id, subreddit, title, url, score, num_comments, posted_at, snapshot_at
  ) VALUES (
    v_reddit_id,
    'norge',
    'Test svarverdi',
    'https://www.reddit.com/comments/' || v_reddit_id || '/',
    20,
    8,
    now() - interval '2 hours',
    now()
  )
  ON CONFLICT (reddit_id) DO UPDATE
  SET
    score = EXCLUDED.score,
    num_comments = EXCLUDED.num_comments,
    reply_worth_status = 'pending',
    reply_worth = NULL,
    reply_worth_reason = NULL,
    reply_worth_model = NULL,
    reply_worth_scored_at = NULL,
    reply_gate_passes = NULL;

  v_result := public.n8n_set_reddit_reply_worth(
    v_reddit_id, 'skipped', NULL, 'gate: for få kommentarer', NULL, false
  );
  IF coalesce((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'skip feilet: %', v_result;
  END IF;
  IF (v_result ->> 'reply_worth_status') <> 'skipped' THEN
    RAISE EXCEPTION 'forventet skipped, fikk %', v_result;
  END IF;

  v_result := public.n8n_set_reddit_reply_worth(
    v_reddit_id, 'scored', 5, 'Åpent samfunnsspørsmål', 'gemma4:26b', true
  );
  IF coalesce((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'score feilet: %', v_result;
  END IF;
  IF (v_result ->> 'reply_worth')::int <> 5 THEN
    RAISE EXCEPTION 'forventet worth 5, fikk %', v_result;
  END IF;

  DELETE FROM public.reddit_signals WHERE reddit_id = v_reddit_id;

  RAISE NOTICE 'reddit_reply_worth.sql: ok';
END;
$$;
