-- Integrasjonstest for research_briefs og n8n-RPC-er (CI db-security).
DO $$
DECLARE
  v_cluster_id uuid := 'a1111111-1111-4111-8111-111111111101';
  v_request_id uuid := 'b2222222-2222-4222-8222-222222222202';
  v_reel_request_id uuid := 'c3333333-3333-4333-8333-333333333303';
  r jsonb;
  v_status text;
  v_summary text;
  v_expired int;
  v_fn regprocedure;
  v_fns text[] := ARRAY[
    'public.n8n_upsert_research_brief(uuid,text,text,jsonb,jsonb,jsonb,text)',
    'public.n8n_set_research_output(uuid,text)',
    'public.n8n_get_research_brief(uuid)',
    'public.n8n_create_research_reel_draft(uuid,text,text,text,jsonb,jsonb)',
    'public.research_briefs_expire_stale(int)',
    'public.research_briefs_validate_perspectives(jsonb)',
    'public.research_briefs_validate_sources(jsonb)',
    'public.research_brief_status_rank(text)',
    'public.research_briefs_is_backwards_status(text,text)'
  ];
  v_name text;
BEGIN
  IF to_regclass('public.research_briefs') IS NULL THEN
    RAISE EXCEPTION 'research_briefs.sql: forventet tabell research_briefs';
  END IF;

  IF to_regclass('public.action_clusters') IS NULL THEN
    RAISE EXCEPTION 'research_briefs.sql: forventet tabell action_clusters';
  END IF;

  INSERT INTO public.action_clusters (
    id,
    action_key,
    action_type,
    action_name,
    description_nb
  )
  VALUES (
    v_cluster_id,
    'ci-research-briefs-' || v_cluster_id::text,
    'opprop',
    'CI research briefs',
    'Testklynge for research_briefs.sql'
  )
  ON CONFLICT (id) DO UPDATE SET
    action_name = EXCLUDED.action_name,
    description_nb = EXCLUDED.description_nb;

  FOREACH v_name IN ARRAY v_fns
  LOOP
    v_fn := to_regprocedure(v_name);
    IF v_fn IS NULL THEN
      RAISE EXCEPTION 'research_briefs.sql: mangler funksjon %', v_name;
    END IF;
    IF has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon har EXECUTE på %', v_name;
    END IF;
    IF has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated har EXECUTE på %', v_name;
    END IF;
    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role mangler EXECUTE på %', v_name;
    END IF;
  END LOOP;

  DELETE FROM public.research_briefs WHERE request_id IN (v_request_id, v_reel_request_id);

  INSERT INTO public.research_briefs (request_id, cluster_id, kind, status)
  VALUES (v_request_id, v_cluster_id, 'deepen', 'queued');

  r := public.n8n_upsert_research_brief(
    v_request_id,
    'running',
    'Kort sammendrag',
    jsonb_build_array(
      jsonb_build_object(
        'actor', 'Testpartiet',
        'actor_type', 'parti',
        'stance', 'for',
        'summary', 'Støtter',
        'independent', true,
        'quotes', jsonb_build_array(
          jsonb_build_object('text', 'Sitat', 'url', 'https://example.com/a', 'publisher', 'nrk.no')
        )
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'url', 'https://example.com/b',
        'publisher', 'nrk.no',
        'title', 'Artikkel',
        'published_at', '2026-01-01T00:00:00Z',
        'excerpt', 'Utdrag',
        'source_kind', 'news_rss',
        'used', true
      )
    ),
    jsonb_build_object('open_questions', jsonb_build_array('Hva med X?'), 'unverified', jsonb_build_array()),
    NULL
  );

  IF coalesce(r ->> 'ok', 'false') <> 'true' OR r ->> 'status' <> 'running' THEN
    RAISE EXCEPTION 'n8n_upsert_research_brief running feilet: %', r;
  END IF;

  r := public.n8n_upsert_research_brief(v_request_id, 'running', NULL, NULL, NULL, NULL, NULL);
  SELECT summary INTO v_summary FROM public.research_briefs WHERE request_id = v_request_id;
  IF v_summary IS DISTINCT FROM 'Kort sammendrag' THEN
    RAISE EXCEPTION 'summary skulle bevares ved null-felter';
  END IF;

  r := public.n8n_upsert_research_brief(v_request_id, 'done', NULL, NULL, NULL, NULL, NULL);
  IF r ->> 'status' <> 'done' THEN
    RAISE EXCEPTION 'forventet done: %', r;
  END IF;

  r := public.n8n_upsert_research_brief(
    v_request_id,
    'running',
    'Skulle ikke lagres',
    jsonb_build_array(
      jsonb_build_object(
        'actor', 'X',
        'actor_type', 'parti',
        'stance', 'mot',
        'summary', 'Ny'
      )
    ),
    NULL,
    NULL,
    NULL
  );
  IF r ->> 'status' <> 'done' THEN
    RAISE EXCEPTION 'bakovergående status skulle være no-op: %', r;
  END IF;
  SELECT summary INTO v_summary FROM public.research_briefs WHERE request_id = v_request_id;
  IF v_summary <> 'Kort sammendrag' THEN
    RAISE EXCEPTION 'sent summary skulle ikke oppdateres ved bakovergående status';
  END IF;

  r := public.n8n_get_research_brief(v_request_id);
  IF r ->> 'request_id' IS DISTINCT FROM v_request_id::text THEN
    RAISE EXCEPTION 'n8n_get_research_brief feilet: %', r;
  END IF;

  ALTER TABLE public.research_briefs DISABLE TRIGGER research_briefs_updated_at;
  UPDATE public.research_briefs
  SET status = 'queued', updated_at = now() - interval '2 hours', error = NULL
  WHERE request_id = v_request_id;
  ALTER TABLE public.research_briefs ENABLE TRIGGER research_briefs_updated_at;

  v_expired := public.research_briefs_expire_stale(30);
  IF v_expired < 1 THEN
    RAISE EXCEPTION 'forventet minst én utløpt brief, fikk %', v_expired;
  END IF;

  SELECT status INTO v_status FROM public.research_briefs WHERE request_id = v_request_id;
  IF v_status <> 'failed' THEN
    RAISE EXCEPTION 'forventet failed etter timeout, fikk %', v_status;
  END IF;

  IF (SELECT error FROM public.research_briefs WHERE request_id = v_request_id) <> 'tidsavbrudd' THEN
    RAISE EXCEPTION 'forventet error tidsavbrudd';
  END IF;

  IF to_regprocedure('public.n8n_create_research_reel_draft(uuid,text,text,text,jsonb,jsonb)') IS NOT NULL
    AND to_regprocedure('public.create_system_poll_draft(text,text,text,jsonb,jsonb)') IS NOT NULL THEN
    INSERT INTO public.research_briefs (request_id, cluster_id, kind, status)
    VALUES (v_reel_request_id, v_cluster_id, 'reel', 'running');

    r := public.n8n_create_research_reel_draft(
      v_reel_request_id,
      NULL,
      'Test Reel fra research',
      'Nøytralt sammendrag',
      jsonb_build_array('https://example.com/c'),
      jsonb_build_object('confidence', 0.9)
    );

    IF coalesce(r ->> 'ok', 'false') <> 'true' OR r ->> 'poll_id' IS NULL THEN
      RAISE EXCEPTION 'n8n_create_research_reel_draft feilet: %', r;
    END IF;

    r := public.n8n_create_research_reel_draft(
      v_reel_request_id,
      NULL,
      'Test Reel fra research',
      'Nøytralt sammendrag',
      '[]'::jsonb,
      '{}'::jsonb
    );

    IF coalesce(r ->> 'created', 'true') = 'true' THEN
      RAISE EXCEPTION 'andre kall skulle returnere eksisterende output_ref';
    END IF;
  END IF;

  DELETE FROM public.research_briefs WHERE request_id IN (v_request_id, v_reel_request_id);
  DELETE FROM public.action_clusters WHERE id = v_cluster_id;
  RAISE NOTICE 'research_briefs.sql: OK';
END $$;
