-- CI: n8n_list_v2_priority_issues matches per-issue tier logic; no per-row fm_embedding_v2_issue_tier.

DO $$
DECLARE
  v_issue_active text := 'embed-v2-list-active';
  v_issue_other text := 'embed-v2-list-other';
  v_doc text := 'doc-list-priority';
  v_tier int;
  v_mismatch int;
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
    (v_issue_active, 'Active sak', now(), now(), false, '{"sak_sesjon":"2099-2100"}'::jsonb),
    (v_issue_other, 'Older sak', now() - interval '90 days', now() - interval '90 days', true, '{"sak_sesjon":"1885-1886"}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET
    last_synced_at = EXCLUDED.last_synced_at,
    last_updated_at = EXCLUDED.last_updated_at,
    ferdigbehandlet = EXCLUDED.ferdigbehandlet,
    detail_json = EXCLUDED.detail_json;

  INSERT INTO public.stortinget_issue_documents (issue_id, document_id, title, document_type, ingest_status, chunks_status)
  VALUES
    (v_issue_active, v_doc, 'Innstilling', 'innstilling', 'ready', 'pending'),
    (v_issue_other, v_doc, 'Innstilling', 'innstilling', 'ready', 'pending')
  ON CONFLICT DO NOTHING;

  DELETE FROM public.document_chunks WHERE issue_id IN (v_issue_active, v_issue_other);

  INSERT INTO public.document_chunks (issue_id, document_id, chunk_index, content, embedding_status, embedding_v2_status)
  VALUES
    (v_issue_active, v_doc, 0, 'active chunk a', 'pending', 'pending'),
    (v_issue_active, v_doc, 1, 'active chunk b', 'pending', 'pending'),
    (v_issue_other, v_doc, 0, 'other chunk', 'pending', 'pending');

  FOREACH v_tier IN ARRAY ARRAY[
    public.fm_embedding_v2_issue_tier(v_issue_active),
    public.fm_embedding_v2_issue_tier(v_issue_other)
  ]
  LOOP
    CONTINUE WHEN v_tier IS NULL;

    WITH limits AS (
      SELECT 50 AS lim, 1 AS wcount, 0 AS windex
    ),
    issues AS (
      SELECT DISTINCT c.issue_id
      FROM public.document_chunks c
      WHERE c.issue_id IS NOT NULL
        AND c.embedding_v2 IS NULL
        AND c.embedding_v2_status = 'pending'
        AND coalesce(btrim(c.content), '') <> ''
    ),
    ref AS (
      SELECT
        i.issue_id,
        count(*)::int AS pending_chunks
      FROM issues i
      JOIN public.document_chunks c ON c.issue_id = i.issue_id
        AND c.embedding_v2 IS NULL
        AND c.embedding_v2_status = 'pending'
        AND coalesce(btrim(c.content), '') <> ''
      WHERE public.fm_embedding_v2_issue_tier(i.issue_id) = v_tier
      GROUP BY i.issue_id
    ),
    ref_limited AS (
      SELECT r.issue_id, r.pending_chunks
      FROM ref r
      ORDER BY r.pending_chunks DESC, r.issue_id ASC
      LIMIT (SELECT lim FROM limits)
    ),
    new_limited AS (
      SELECT n.issue_id, n.pending_chunks
      FROM public.n8n_list_v2_priority_issues(v_tier, 50, 0, 1) n
    )
    SELECT count(*)
    INTO v_mismatch
    FROM (
      SELECT n.issue_id, n.pending_chunks FROM new_limited n
      EXCEPT
      SELECT r.issue_id, r.pending_chunks FROM ref_limited r
      UNION ALL
      SELECT r.issue_id, r.pending_chunks FROM ref_limited r
      EXCEPT
      SELECT n.issue_id, n.pending_chunks FROM new_limited n
    ) diff;

    IF v_mismatch <> 0 THEN
      RAISE EXCEPTION 'tier %: n8n_list_v2_priority_issues avviker fra referanse', v_tier;
    END IF;
  END LOOP;

  RAISE NOTICE 'n8n_list_v2_priority_issues_batch_tiers.sql: ok';
END $$;
