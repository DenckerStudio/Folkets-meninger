-- Integrasjonstest for research_briefs og n8n-RPC-er (CI db-security).
DO $$
DECLARE
  v_cluster_id uuid;
  v_request_id uuid := gen_random_uuid();
  v_reel_request_id uuid := gen_random_uuid();
  r jsonb;
  v_status text;
  v_summary text;
  v_expired int;
BEGIN
  IF to_regclass('public.research_briefs') IS NULL THEN
    RAISE NOTICE 'research_briefs.sql: hopper over (tabell finnes ikke)';
    RETURN;
  END IF;

  IF to_regprocedure('public.n8n_upsert_research_brief(uuid,text,text,jsonb,jsonb,jsonb,text)') IS NULL THEN
    RAISE NOTICE 'research_briefs.sql: hopper over (RPC finnes ikke)';
    RETURN;
  END IF;

  SELECT id INTO v_cluster_id FROM public.action_clusters LIMIT 1;
  IF v_cluster_id IS NULL THEN
    RAISE NOTICE 'research_briefs.sql: hopper over (ingen klynger)';
    RETURN;
  END IF;

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

  r := public.n8n_upsert_research_brief(v_request_id, 'running', 'Nytt', NULL, NULL, NULL, NULL);
  IF r ->> 'status' <> 'done' OR (r ->> 'summary') <> 'Kort sammendrag' THEN
    RAISE EXCEPTION 'bakovergående status skulle være no-op: %', r;
  END IF;

  r := public.n8n_get_research_brief(v_request_id);
  IF r ->> 'request_id' IS DISTINCT FROM v_request_id::text THEN
    RAISE EXCEPTION 'n8n_get_research_brief feilet: %', r;
  END IF;

  UPDATE public.research_briefs
  SET status = 'queued', updated_at = now() - interval '2 hours', error = NULL
  WHERE request_id = v_request_id;

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

  IF to_regprocedure('public.n8n_create_research_reel_draft(uuid,text,text,text,jsonb,jsonb)') IS NOT NULL THEN
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
  RAISE NOTICE 'research_briefs.sql: OK';
END $$;
