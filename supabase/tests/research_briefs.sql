-- Integrasjonstest for research_briefs og n8n-RPC-er (CI db-security).
DO $$
DECLARE
  v_cluster_id uuid;
  v_request_id uuid := gen_random_uuid();
  r jsonb;
BEGIN
  IF to_regclass('public.research_briefs') IS NULL THEN
    RAISE NOTICE 'research_briefs.sql: hopper over (tabell finnes ikke)';
    RETURN;
  END IF;

  IF to_regprocedure('public.n8n_upsert_research_brief(uuid,text,text,jsonb,jsonb,text)') IS NULL THEN
    RAISE NOTICE 'research_briefs.sql: hopper over (RPC finnes ikke)';
    RETURN;
  END IF;

  SELECT id INTO v_cluster_id FROM public.action_clusters LIMIT 1;
  IF v_cluster_id IS NULL THEN
    RAISE NOTICE 'research_briefs.sql: hopper over (ingen klynger)';
    RETURN;
  END IF;

  DELETE FROM public.research_briefs WHERE request_id = v_request_id;

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
        'excerpt', 'Utdrag'
      )
    ),
    NULL
  );

  IF coalesce(r ->> 'ok', 'false') <> 'true' THEN
    RAISE EXCEPTION 'n8n_upsert_research_brief feilet: %', r;
  END IF;

  r := public.n8n_upsert_research_brief(v_request_id, 'running', NULL, '[]'::jsonb, '[]'::jsonb, NULL);
  IF (SELECT summary FROM public.research_briefs WHERE request_id = v_request_id) IS DISTINCT FROM 'Kort sammendrag' THEN
    RAISE EXCEPTION 'summary skulle bevares ved null summary';
  END IF;

  r := public.n8n_set_research_output(v_request_id, 'payload-post-123');
  IF (SELECT status FROM public.research_briefs WHERE request_id = v_request_id) <> 'done' THEN
    RAISE EXCEPTION 'forventet status done etter output';
  END IF;

  BEGIN
    PERFORM public.n8n_upsert_research_brief(v_request_id, 'bogus', NULL, '[]'::jsonb, '[]'::jsonb, NULL);
    RAISE EXCEPTION 'forventet invalid_status exception';
  EXCEPTION
    WHEN sqlstate '22023' THEN
      NULL;
  END;

  DELETE FROM public.research_briefs WHERE request_id = v_request_id;
  RAISE NOTICE 'research_briefs.sql: OK';
END $$;
