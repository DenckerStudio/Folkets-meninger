-- CI: n8n_upsert_issue_ai_summary — how_affected/kostnad + p_forslag NULL vs [].
DO $$
DECLARE
  v_issue_id text := 'test:cursor-n8n-upsert-ai-summary';
  v_cost text := 'Det er ikke oppgitt hvilke eksakte kostnader som blir knyttet til forslaget.';
  v_how text;
  v_kostnad text;
  v_forslag jsonb;
  v_proc_9 regprocedure;
  v_proc_10 regprocedure;
BEGIN
  v_proc_9 := to_regprocedure(
    'public.n8n_upsert_issue_ai_summary(text,text,text,text,text,text,text,jsonb,text[])'
  );
  v_proc_10 := to_regprocedure(
    'public.n8n_upsert_issue_ai_summary(text,text,text,text,text,text,text,jsonb,text[],jsonb)'
  );

  IF v_proc_10 IS NULL AND v_proc_9 IS NULL THEN
    RAISE NOTICE 'n8n_upsert_issue_ai_summary.sql: hopper over (RPC ikke migrert)';
    RETURN;
  END IF;

  DELETE FROM public.issue_ai_summaries WHERE stortinget_issue_id = v_issue_id;

  IF v_proc_9 IS NOT NULL THEN
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
  ELSE
    PERFORM public.n8n_upsert_issue_ai_summary(
      v_issue_id,
      repeat('Hva ', 12),
      repeat('Hvem ', 8),
      v_cost,
      repeat('Narr ', 12),
      repeat('Who ', 8),
      NULL,
      '[]'::jsonb,
      ARRAY[]::text[],
      NULL
    );
  END IF;

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

  IF v_proc_10 IS NOT NULL THEN
    PERFORM public.n8n_upsert_issue_ai_summary(
      v_issue_id,
      repeat('Hva ', 12),
      repeat('Hvem ', 8),
      v_cost,
      repeat('Narr ', 12),
      repeat('Who ', 8),
      'Konkrete endringer i hverdagen for berørte grupper.',
      '[]'::jsonb,
      ARRAY[]::text[],
      '["Forslag ett","Forslag to"]'::jsonb
    );

    SELECT forslag INTO v_forslag
    FROM public.issue_ai_summaries
    WHERE stortinget_issue_id = v_issue_id;

    IF v_forslag IS DISTINCT FROM '["Forslag ett", "Forslag to"]'::jsonb
       AND v_forslag IS DISTINCT FROM '["Forslag ett","Forslag to"]'::jsonb THEN
      RAISE EXCEPTION 'forventet forslag lagret, fikk %', v_forslag;
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
      ARRAY[]::text[],
      NULL
    );

    SELECT forslag INTO v_forslag
    FROM public.issue_ai_summaries
    WHERE stortinget_issue_id = v_issue_id;

    IF jsonb_array_length(v_forslag) <> 2 THEN
      RAISE EXCEPTION 'p_forslag NULL skulle beholde forslag, fikk %', v_forslag;
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
      ARRAY[]::text[],
      '[]'::jsonb
    );

    SELECT forslag INTO v_forslag
    FROM public.issue_ai_summaries
    WHERE stortinget_issue_id = v_issue_id;

    IF v_forslag IS DISTINCT FROM '[]'::jsonb THEN
      RAISE EXCEPTION 'p_forslag [] skulle tømme forslag, fikk %', v_forslag;
    END IF;
  END IF;

  DELETE FROM public.issue_ai_summaries WHERE stortinget_issue_id = v_issue_id;
END $$;
