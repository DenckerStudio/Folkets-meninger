-- CI: admin_publish_stortinget_poll archives system reel, opens stortinget poll, no auto feedback.

DO $$
DECLARE
  v_issue_id text := 'ci-admin-publish-stortinget';
  v_original_title text := 'Opprinnelig sakstittel fra Stortinget';
  v_system_poll_id uuid;
  v_stortinget_poll_id uuid;
  v_stortinget_poll_id_2 uuid;
  v_feedback_count int;
BEGIN
  IF to_regprocedure(
    'public.admin_publish_stortinget_poll(text,text,text,jsonb,timestamp with time zone,boolean)'
  ) IS NULL THEN
    RAISE NOTICE 'admin_publish_stortinget_poll.sql: hopper over (migrasjon ikke kjørt)';
    RETURN;
  END IF;

  INSERT INTO public.stortinget_issues (id, title, summary, last_synced_at)
  VALUES (v_issue_id, v_original_title, 'Opprinnelig sammendrag', now())
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    last_synced_at = now();

  DELETE FROM public.content_feedback
  WHERE content_type = 'reel'
    AND content_id IN (
      SELECT id::text FROM public.polls WHERE stortinget_issue_id = v_issue_id
    );

  DELETE FROM public.poll_votes
  WHERE poll_id IN (SELECT id FROM public.polls WHERE stortinget_issue_id = v_issue_id);

  DELETE FROM public.polls WHERE stortinget_issue_id = v_issue_id;

  INSERT INTO public.polls (
    track, status, title, neutral_summary, stortinget_issue_id, source_urls, opens_at
  )
  VALUES (
    'system',
    'open',
    'System reel spørsmål',
    'System sammendrag',
    v_issue_id,
    '[]'::jsonb,
    now()
  )
  RETURNING id INTO v_system_poll_id;

  v_stortinget_poll_id := public.admin_publish_stortinget_poll(
    v_issue_id,
    'Admin Stortinget tittel',
    'Nøytralt admin-sammendrag',
    '[{"url":"https://www.stortinget.no","label":"Stortinget"}]'::jsonb
  );

  IF v_stortinget_poll_id IS NULL THEN
    RAISE EXCEPTION 'admin_publish_stortinget_poll returnerte NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.polls
    WHERE id = v_system_poll_id AND track = 'system' AND status = 'archived'
  ) THEN
    RAISE EXCEPTION 'system poll skulle være archived';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.polls
    WHERE id = v_stortinget_poll_id
      AND track = 'stortinget'
      AND status = 'open'
      AND title = 'Admin Stortinget tittel'
  ) THEN
    RAISE EXCEPTION 'stortinget poll skulle være open med admin-tittel';
  END IF;

  SELECT count(*) INTO v_feedback_count
  FROM public.content_feedback
  WHERE content_type = 'reel' AND content_id = v_system_poll_id::text;

  IF v_feedback_count <> 0 THEN
    RAISE EXCEPTION 'forventet ingen content_feedback for arkivert system poll, fant %', v_feedback_count;
  END IF;

  IF (SELECT title FROM public.stortinget_issues WHERE id = v_issue_id) <> v_original_title THEN
    RAISE EXCEPTION 'sakstittel skulle være uendret';
  END IF;

  v_stortinget_poll_id_2 := public.admin_publish_stortinget_poll(
    v_issue_id,
    'Admin Stortinget tittel',
    'Nøytralt admin-sammendrag',
    '[{"url":"https://www.stortinget.no","label":"Stortinget"}]'::jsonb
  );

  IF v_stortinget_poll_id_2 IS DISTINCT FROM v_stortinget_poll_id THEN
    RAISE EXCEPTION 'andre kjøring skulle returnere samme poll-id';
  END IF;

  IF (
    SELECT count(*) FROM public.polls
    WHERE stortinget_issue_id = v_issue_id
      AND track = 'stortinget'
      AND status IN ('draft', 'open', 'closed')
  ) <> 1 THEN
    RAISE EXCEPTION 'forventet nøyaktig én aktiv stortinget-poll';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.admin_publish_stortinget_poll(text,text,text,jsonb,timestamp with time zone,boolean)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon skal ikke kunne kjøre admin_publish_stortinget_poll';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.admin_publish_stortinget_poll(text,text,text,jsonb,timestamp with time zone,boolean)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated skal ikke kunne kjøre admin_publish_stortinget_poll';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.admin_publish_stortinget_poll(text,text,text,jsonb,timestamp with time zone,boolean)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role mangler EXECUTE på admin_publish_stortinget_poll';
  END IF;
END;
$$;
