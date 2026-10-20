-- CI: n8n_upsert_issue_ai_summary must not copy kostnad into how_affected when how_affected is empty.
DO $$
DECLARE
  v_issue_id text := 'test:cursor-n8n-upsert-ai-summary';
  v_cost text := 'Det er ikke oppgitt hvilke eksakte kostnader som blir knyttet til forslaget.';
  v_how text;
  v_kostnad text;
BEGIN
  IF to_regprocedure(
    'public.n8n_upsert_issue_ai_summary(text,text,text,text,text,text,text,jsonb,text[])'
  ) IS NULL THEN
    RAISE NOTICE 'n8n_upsert_issue_ai_summary.sql: hopper over (RPC ikke migrert)';
    RETURN;
  END IF;

  DELETE FROM public.issue_ai_summaries WHERE stortinget_issue_id = v_issue_id;

  PERFORM public.n8n_upsert_issue_ai_summary(
    v_issue_id,
    repeat('Hva ', 12),
    repeat('Hvem ', 8),
    v_cost,
    repeat('Narr ', 12),
    repeat('Who ', 8),
    NULL,
    '[]'::jsonb,
    ARRAY[]::text[]
  );

  SELECT how_affected, kostnad
  INTO v_how, v_kostnad
  FROM public.issue_ai_summaries
  WHERE stortinget_issue_id = v_issue_id;

  IF v_kostnad IS DISTINCT FROM v_cost THEN
    RAISE EXCEPTION 'forventet kostnad lagret, fikk %', v_kostnad;
  END IF;

  IF v_how IS NOT NULL AND btrim(v_how) <> '' THEN
    RAISE EXCEPTION 'how_affected skulle være tom/null, fikk %', v_how;
  END IF;

  PERFORM public.n8n_upsert_issue_ai_summary(
    v_issue_id,
    repeat('Hva ', 12),
    repeat('Hvem ', 8),
    v_cost,
    repeat('Narr ', 12),
    repeat('Who ', 8),
    'Konkrete endringer i hverdagen for berørte grupper.',
    '[]'::jsonb,
    ARRAY[]::text[]
  );

  SELECT how_affected INTO v_how
  FROM public.issue_ai_summaries
  WHERE stortinget_issue_id = v_issue_id;

  IF v_how IS DISTINCT FROM 'Konkrete endringer i hverdagen for berørte grupper.' THEN
    RAISE EXCEPTION 'how_affected skulle lagres eksplisitt, fikk %', v_how;
  END IF;

  DELETE FROM public.issue_ai_summaries WHERE stortinget_issue_id = v_issue_id;
END $$;
