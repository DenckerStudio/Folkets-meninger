-- CI: n8n_list_v2_priority_issues matches per-issue tier logic; no per-row fm_embedding_v2_issue_tier.

DO $$
DECLARE
  v_tier int;
  v_lim int;
  v_windex int;
  v_wcount int;
  v_expected text;
  v_got text;
  v_issue_t0 text := 'embed-v2-list-tier0';
  v_issue_t2 text := 'embed-v2-list-tier2';
  v_doc text := 'doc-list-priority';
BEGIN
  IF to_regprocedure('public.n8n_list_v2_priority_issues(int,int,int,int)') IS NULL THEN
    RAISE NOTICE 'n8n_list_v2_priority_issues_batch_tiers.sql: hopper over (migrasjon 26110100 ikke kjørt)';
    RETURN;
  END IF;

  IF (
    SELECT pg_get_functiondef('public.n8n_list_v2_priority_issues(int,int,int,int)'::regprocedure)
  ) ILIKE '%fm_embedding_v2_issue_tier(%' THEN
    RAISE EXCEPTION 'n8n_list_v2_priority_issues skal ikke kalle fm_embedding_v2_issue_tier per rad';
  END IF;

  IF to_regprocedure('public.fm_embedding_v2_issue_tiers(text[])') IS NULL THEN
    RAISE NOTICE 'n8n_list_v2_priority_issues_batch_tiers.sql: hopper over (migrasjon 26110400 ikke kjørt)';
    RETURN;
  END IF;

  INSERT INTO public.stortinget_issues (id, title, last_synced_at, last_updated_at, ferdigbehandlet, detail_json)
  VALUES
    (v_issue_t0, 'Tier0 test', now(), now(), false, '{"sak_sesjon":"2099-2100"}'::jsonb),
    (v_issue_t2, 'Tier2 test', now() - interval '60 days', now() - interval '60 days', true, '{"sak_sesjon":"1999-2000"}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET
    last_synced_at = EXCLUDED.last_synced_at,
    last_updated_at = EXCLUDED.last_updated_at,
    ferdigbehandlet = EXCLUDED.ferdigbehandlet,
    detail_json = EXCLUDED.detail_json;

  INSERT INTO public.stortinget_issue_documents (issue_id, document_id, title, document_type, ingest_status, chunks_status)
  VALUES
    (v_issue_t0, v_doc, 'Innstilling', 'innstilling', 'ready', 'pending'),
    (v_issue_t2, v_doc, 'Innstilling', 'innstilling', 'ready', 'pending')
  ON CONFLICT DO NOTHING;

  DELETE FROM public.document_chunks WHERE issue_id IN (v_issue_t0, v_issue_t2);

  INSERT INTO public.document_chunks (issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status)
  VALUES
    (v_issue_t0, v_doc, 0, 'tier0 chunk a', 'pending', 'pending'),
    (v_issue_t0, v_doc, 1, 'tier0 chunk b', 'pending', 'pending'),
    (v_issue_t2, v_doc, 0, 'tier2 chunk', 'pending', 'pending');

  IF public.fm_embedding_v2_issue_tier(v_issue_t0) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'fixture tier0 forventet 0, fikk %', public.fm_embedding_v2_issue_tier(v_issue_t0);
  END IF;

  IF public.fm_embedding_v2_issue_tier(v_issue_t2) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'fixture tier2 forventet 2, fikk %', public.fm_embedding_v2_issue_tier(v_issue_t2);
  END IF;

  FOR v_tier, v_lim, v_windex, v_wcount IN
    SELECT * FROM (VALUES
      (0, 50, 0, 1),
      (2, 50, 0, 1),
      (0, 1, 0, 1),
      (2, 1, 0, 2)
    ) AS cfg(tier, lim, windex, wcount)
  LOOP
    SELECT s.issue_id
    INTO v_expected
    FROM (
      WITH limits AS (
        SELECT
          greatest(1, least(v_lim, 500)) AS lim,
          greatest(1, v_wcount) AS wcount,
          greatest(0, least(v_windex, greatest(1, v_wcount) - 1)) AS windex
      ),
      issues AS (
        SELECT DISTINCT c.issue_id
        FROM public.document_chunks c
        WHERE c.issue_id IS NOT NULL
          AND c.embedding_v2 IS NULL
          AND c.embedding_v2_status = 'pending'
          AND coalesce(btrim(c.content), '') <> ''
      ),
      scored AS (
        SELECT
          i.issue_id,
          public.fm_embedding_v2_issue_tier(i.issue_id) AS tier,
          count(*)::int AS pending_chunks
        FROM issues i
        JOIN public.document_chunks c ON c.issue_id = i.issue_id
          AND c.embedding_v2 IS NULL
          AND c.embedding_v2_status = 'pending'
          AND coalesce(btrim(c.content), '') <> ''
        CROSS JOIN limits l
        WHERE public.fm_embedding_v2_issue_tier(i.issue_id) = v_tier
          AND (
            l.wcount <= 1
            OR abs(hashtext(i.issue_id)) % l.wcount = l.windex
          )
        GROUP BY i.issue_id
      )
      SELECT s.issue_id, s.pending_chunks
      FROM scored s
      CROSS JOIN limits l
      ORDER BY s.pending_chunks DESC, s.issue_id ASC
      LIMIT (SELECT lim FROM limits)
    ) s;

    SELECT n.issue_id
    INTO v_got
    FROM public.n8n_list_v2_priority_issues(v_tier, v_lim, v_windex, v_wcount) n
    LIMIT 1;

    IF v_expected IS DISTINCT FROM v_got THEN
      RAISE EXCEPTION 'tier=% lim=% w=%/% forventet % fikk %',
        v_tier, v_lim, v_windex, v_wcount, v_expected, v_got;
    END IF;
  END LOOP;

  RAISE NOTICE 'n8n_list_v2_priority_issues_batch_tiers.sql: ok';
END $$;
