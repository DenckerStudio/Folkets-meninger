-- Align AI-learning n8n RPCs with n8n-folkets/ai-laering handoff (2026-10-18).

BEGIN;

ALTER TABLE public.issue_ai_summaries
  ADD COLUMN IF NOT EXISTS generation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Drop ambiguous / legacy upsert signatures (PGRST203).
DROP FUNCTION IF EXISTS public.n8n_upsert_issue_ai_summary(text, text, text, text);
DROP FUNCTION IF EXISTS public.n8n_upsert_issue_ai_summary(
  text, text, text, text, text, text, text, jsonb, text[]
);

DROP FUNCTION IF EXISTS public.n8n_get_active_prompt(text, text);
DROP FUNCTION IF EXISTS public.n8n_get_active_prompt(text);
DROP FUNCTION IF EXISTS public.n8n_record_eval_run(jsonb);

CREATE OR REPLACE FUNCTION public.ai_prompt_version_public_json(p public.ai_prompt_versions)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'version', p.version,
    'status', p.status,
    'system_prompt', p.system_prompt,
    'user_template', p.user_template,
    'model', p.model,
    'model_options', p.model_options
  );
$$;

CREATE OR REPLACE FUNCTION public.n8n_get_active_prompt(p_workflow_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.ai_prompt_version_public_json(p)
  FROM public.ai_prompt_versions p
  WHERE p.workflow_key = p_workflow_key
    AND p.node_key = 'system'
    AND p.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.n8n_list_prompt_candidates(p_workflow_key text)
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.ai_prompt_version_public_json(p)
  FROM public.ai_prompt_versions p
  WHERE p.workflow_key = p_workflow_key
    AND p.node_key = 'system'
    AND p.status = 'candidate'
  ORDER BY p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.n8n_record_eval_run(
  p_run_id uuid,
  p_workflow_key text,
  p_kind text,
  p_prompt_version_id uuid,
  p_baseline_version_id uuid,
  p_model text,
  p_n_cases int,
  p_summary jsonb,
  p_verdict text,
  p_report_md text,
  p_finished_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := p_run_id;
BEGIN
  IF v_id IS NULL THEN
    INSERT INTO public.ai_eval_runs (
      workflow_key, kind, prompt_version_id, baseline_version_id, model,
      n_cases, summary, verdict, report_md, finished_at
    )
    VALUES (
      p_workflow_key,
      coalesce(p_kind, 'weekly'),
      p_prompt_version_id,
      p_baseline_version_id,
      coalesce(p_model, 'unknown'),
      p_n_cases,
      p_summary,
      p_verdict,
      p_report_md,
      p_finished_at
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.ai_eval_runs
    SET
      workflow_key = coalesce(p_workflow_key, workflow_key),
      kind = coalesce(p_kind, kind),
      prompt_version_id = coalesce(p_prompt_version_id, prompt_version_id),
      baseline_version_id = coalesce(p_baseline_version_id, baseline_version_id),
      model = coalesce(p_model, model),
      n_cases = coalesce(p_n_cases, n_cases),
      summary = coalesce(p_summary, summary),
      verdict = coalesce(p_verdict, verdict),
      report_md = coalesce(p_report_md, report_md),
      finished_at = coalesce(p_finished_at, finished_at)
    WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Eval run not found: %', v_id;
    END IF;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_record_eval_result(
  p_run_id uuid,
  p_case_id uuid,
  p_variant text,
  p_output jsonb,
  p_guard_hits jsonb,
  p_numbers_ok boolean,
  p_key_facts_recall numeric,
  p_chunk_recall numeric,
  p_judge jsonb,
  p_pairwise text,
  p_latency_ms int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.ai_eval_results (
    run_id, case_id, variant, output, guard_hits, numbers_ok,
    key_facts_recall, chunk_recall, judge, pairwise, latency_ms
  )
  VALUES (
    p_run_id, p_case_id, p_variant, p_output, p_guard_hits, p_numbers_ok,
    p_key_facts_recall, p_chunk_recall, p_judge, p_pairwise, p_latency_ms
  )
  ON CONFLICT (run_id, case_id, variant) DO UPDATE SET
    output = EXCLUDED.output,
    guard_hits = EXCLUDED.guard_hits,
    numbers_ok = EXCLUDED.numbers_ok,
    key_facts_recall = EXCLUDED.key_facts_recall,
    chunk_recall = EXCLUDED.chunk_recall,
    judge = EXCLUDED.judge,
    pairwise = EXCLUDED.pairwise,
    latency_ms = EXCLUDED.latency_ms;
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_ai_weekly_metrics(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_workflows jsonb;
  v_eval_runs jsonb;
  v_span interval;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
    RAISE EXCEPTION 'Invalid period';
  END IF;
  v_span := p_to - p_from;

  SELECT coalesce(jsonb_agg(row_data ORDER BY workflow_key, prompt_version), '[]'::jsonb)
  INTO v_workflows
  FROM (
    SELECT
      jsonb_build_object(
        'workflow_key', g.workflow_key,
        'prompt_version', g.prompt_version,
        'generations', count(*)::int,
        'approved', count(*) FILTER (
          WHERE f.decision = 'approved'
        )::int,
        'approved_with_edits', count(*) FILTER (
          WHERE f.decision = 'approved_with_edits'
        )::int,
        'rejected', count(*) FILTER (
          WHERE f.decision = 'rejected'
        )::int,
        'regenerated', count(*) FILTER (
          WHERE f.decision = 'regenerated'
        )::int,
        'edit_distance_median', percentile_cont(0.5) WITHIN GROUP (ORDER BY f.edit_distance),
        'guard_hits_per_1000_words', NULL,
        'dropped_guard', count(*) FILTER (WHERE g.outcome = 'dropped_guard')::int,
        'llm_failed', count(*) FILTER (WHERE g.outcome = 'llm_failed')::int,
        'latency_p50_ms', percentile_cont(0.5) WITHIN GROUP (ORDER BY g.latency_ms),
        'reason_codes', coalesce((
          SELECT jsonb_object_agg(reason_code, cnt)
          FROM (
            SELECT f2.reason_code, count(*)::int AS cnt
            FROM public.ai_feedback f2
            WHERE f2.reason_code IS NOT NULL
              AND f2.decided_at >= p_from AND f2.decided_at < p_to
            GROUP BY f2.reason_code
          ) rc
        ), '{}'::jsonb),
        'baseline_4w', NULL
      ) AS row_data,
      g.workflow_key,
      g.prompt_version
    FROM public.ai_generations g
    LEFT JOIN public.ai_feedback f
      ON f.generation_id = g.id
      AND f.decided_at >= p_from AND f.decided_at < p_to
    WHERE g.created_at >= p_from AND g.created_at < p_to
      AND g.mode = 'prod'
    GROUP BY g.workflow_key, g.prompt_version
  ) s;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'workflow_key', r.workflow_key,
    'kind', r.kind,
    'verdict', r.verdict,
    'n_cases', r.n_cases,
    'summary', r.summary
  ) ORDER BY r.started_at DESC), '[]'::jsonb)
  INTO v_eval_runs
  FROM public.ai_eval_runs r
  WHERE r.started_at >= p_from AND r.started_at < p_to;

  RETURN jsonb_build_object('workflows', v_workflows, 'eval_runs', v_eval_runs);
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_upsert_issue_ai_summary(
  p_issue_id text,
  p_hva text,
  p_hvem text,
  p_kostnad text,
  p_narrative text DEFAULT NULL,
  p_who_affected text DEFAULT NULL,
  p_how_affected text DEFAULT NULL,
  p_topic_cards jsonb DEFAULT '[]'::jsonb,
  p_labels text[] DEFAULT '{}'::text[],
  p_prompt_version text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_generation_metadata jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hva text := coalesce(nullif(trim(p_hva), ''), nullif(trim(p_narrative), ''), '');
  v_hvem text := coalesce(nullif(trim(p_hvem), ''), nullif(trim(p_who_affected), ''), '');
  v_kostnad text := coalesce(nullif(trim(p_kostnad), ''), '');
  v_narrative text := coalesce(nullif(trim(p_narrative), ''), v_hva);
  v_who text := coalesce(nullif(trim(p_who_affected), ''), v_hvem);
  v_how text := coalesce(nullif(trim(p_how_affected), ''), v_kostnad);
  v_labels text[] := coalesce(p_labels, '{}'::text[]);
  v_generation_id uuid;
  v_meta jsonb := coalesce(p_generation_metadata, '{}'::jsonb);
BEGIN
  v_generation_id := nullif(v_meta ->> 'generation_id', '')::uuid;

  INSERT INTO public.issue_ai_summaries (
    stortinget_issue_id,
    hva,
    hvem,
    kostnad,
    narrative,
    who_affected,
    how_affected,
    topic_cards,
    labels,
    prompt_version,
    model,
    generation_metadata,
    generation_id,
    updated_at
  )
  VALUES (
    p_issue_id,
    v_hva,
    v_hvem,
    v_kostnad,
    v_narrative,
    v_who,
    v_how,
    coalesce(p_topic_cards, '[]'::jsonb),
    v_labels,
    p_prompt_version,
    p_model,
    v_meta,
    v_generation_id,
    now()
  )
  ON CONFLICT (stortinget_issue_id) DO UPDATE SET
    hva = EXCLUDED.hva,
    hvem = EXCLUDED.hvem,
    kostnad = EXCLUDED.kostnad,
    narrative = EXCLUDED.narrative,
    who_affected = EXCLUDED.who_affected,
    how_affected = EXCLUDED.how_affected,
    topic_cards = EXCLUDED.topic_cards,
    labels = EXCLUDED.labels,
    prompt_version = coalesce(EXCLUDED.prompt_version, issue_ai_summaries.prompt_version),
    model = coalesce(EXCLUDED.model, issue_ai_summaries.model),
    generation_metadata = EXCLUDED.generation_metadata,
    generation_id = coalesce(EXCLUDED.generation_id, issue_ai_summaries.generation_id),
    updated_at = now();

  UPDATE public.stortinget_issues
  SET ai_labels = v_labels
  WHERE id = p_issue_id;

  RETURN jsonb_build_object(
    'ok', true,
    'stortinget_issue_id', p_issue_id,
    'generation_id', v_generation_id
  );
END;
$$;

-- Golden eval cases from PR #162 evals/golden/saker.jsonl (sak_summary × 20).

INSERT INTO public.ai_eval_cases (workflow_key, case_key, input, expected, origin, status)
VALUES
('sak_summary', 'sak-01', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200331.\n\nKildemateriale:\nProposisjonen gjelder endringer i statsbudsjettet 2026 som følge av jordbruksavtalen inngått 16. mai 2026 mellom staten, Norges Bondelag og Norsk Bonde- og Småbrukarlag. Stortinget fattet vedtak i tråd med regjeringens forslag, og ba i tillegg regjeringen vurdere tiltak for mer norsk økologisk melk og praktisere den nye viltressursloven uten å endre rettstilstanden for vilt i fangenskap.", "source_texts": ["Proposisjonen gjelder endringer i statsbudsjettet 2026 som følge av jordbruksavtalen inngått 16. mai 2026 mellom staten, Norges Bondelag og Norsk Bonde- og Småbrukarlag. Stortinget fattet vedtak i tråd med regjeringens forslag, og ba i tillegg regjeringen vurdere tiltak for mer norsk økologisk melk og praktisere den nye viltressursloven uten å endre rettstilstanden for vilt i fangenskap."], "issue_id": "200331"}'::jsonb, '{"key_facts": ["Jordbruksoppgjøret 2026|jordbruksavtalen", "Norges Bondelag", "Norsk Bonde- og Småbrukarlag", "16. mai 2026", "Næringskomiteen", "økologisk melk", "viltressurslov"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-02', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200315.\n\nKildemateriale:\nProposisjonen er en del av revidert nasjonalbudsjett 2026, lagt fram 12. mai. Arbeiderpartiet fikk flertall gjennom et budsjettforlik med SV, Sp, Rødt og MDG 7. juni. Oljepengebruken økte med om lag 5 mrd. kroner sammenlignet med regjeringens forslag.", "source_texts": ["Proposisjonen er en del av revidert nasjonalbudsjett 2026, lagt fram 12. mai. Arbeiderpartiet fikk flertall gjennom et budsjettforlik med SV, Sp, Rødt og MDG 7. juni. Oljepengebruken økte med om lag 5 mrd. kroner sammenlignet med regjeringens forslag."], "issue_id": "200315"}'::jsonb, '{"key_facts": ["Tilleggsbevilgninger og omprioriteringer", "statsbudsjettet 2026", "revidert nasjonalbudsjett", "Finanskomiteen", "12. mai", "7. juni", "5 mrd. kroner"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-03', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200313.\n\nKildemateriale:\nS-delen av proposisjonen om endringer i skatte- og avgiftslovgivningen, behandlet sammen med revidert nasjonalbudsjett 2026 i Innst. 450 S. Stortinget vedtok innstillingen uten endringer.", "source_texts": ["S-delen av proposisjonen om endringer i skatte- og avgiftslovgivningen, behandlet sammen med revidert nasjonalbudsjett 2026 i Innst. 450 S. Stortinget vedtok innstillingen uten endringer."], "issue_id": "200313"}'::jsonb, '{"key_facts": ["skatte- og avgiftslovgivinga|skatte- og avgiftslovgivningen", "revidert nasjonalbudsjett 2026", "Finanskomiteen", "budsjettforlik", "Innst. 450 S"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-04', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200330.\n\nKildemateriale:\nRegjeringen foreslo endret kostnadsramme for riksveiprosjektet E134 Røldal–Seljestad i Vestland. Stortinget vedtok forslaget.", "source_texts": ["Regjeringen foreslo endret kostnadsramme for riksveiprosjektet E134 Røldal–Seljestad i Vestland. Stortinget vedtok forslaget."], "issue_id": "200330"}'::jsonb, '{"key_facts": ["E134 Røldal-Seljestad", "kostnadsramme", "Vestland", "Transport- og kommunikasjonskomiteen", "Regjeringens forslag ble vedtatt|vedtatt"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-05', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200335.\n\nKildemateriale:\nMeldingen gjelder trygdeoppgjøret 2026. Grunnbeløpet øker med 4,91 prosent fra 1. mai til 136 549 kroner. Alderspensjon under utbetaling, minste pensjonsnivå og garantipensjon øker med 4,69 prosent.", "source_texts": ["Meldingen gjelder trygdeoppgjøret 2026. Grunnbeløpet øker med 4,91 prosent fra 1. mai til 136 549 kroner. Alderspensjon under utbetaling, minste pensjonsnivå og garantipensjon øker med 4,69 prosent."], "issue_id": "200335"}'::jsonb, '{"key_facts": ["4,69 pst", "136 549 kroner", "4,91 pst", "4,4 pst", "Arbeids- og sosialkomiteen", "minste pensjonsnivå|garantipensjon"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-06', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200350.\n\nKildemateriale:\nStortingsmelding om Helsepersonellplan 2040, til behandling i helse- og omsorgskomiteen med Kjersti Toppe (Sp) som saksordfører.", "source_texts": ["Stortingsmelding om Helsepersonellplan 2040, til behandling i helse- og omsorgskomiteen med Kjersti Toppe (Sp) som saksordfører."], "issue_id": "200350"}'::jsonb, '{"key_facts": ["Helsepersonellplan 2040", "Helse- og omsorgskomiteen", "helsepersonell", "Kjersti Toppe"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-07', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200351.\n\nKildemateriale:\nLovproposisjon om endringer i trossamfunnsloven om taushetsplikt. Saken behandles i familie- og kulturkomiteen, og det er åpnet for skriftlige innspill.", "source_texts": ["Lovproposisjon om endringer i trossamfunnsloven om taushetsplikt. Saken behandles i familie- og kulturkomiteen, og det er åpnet for skriftlige innspill."], "issue_id": "200351"}'::jsonb, '{"key_facts": ["trossamfunnsloven", "taushetsplikt", "Familie- og kulturkomiteen", "Jorunn Gleditsch Lossius"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-08', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200370.\n\nKildemateriale:\nLovproposisjon om endringer i utlendingsloven om familiegjenforening med barn. Saken ligger i kommunal- og forvaltningskomiteen med høringsfrist 26. oktober 2026.", "source_texts": ["Lovproposisjon om endringer i utlendingsloven om familiegjenforening med barn. Saken ligger i kommunal- og forvaltningskomiteen med høringsfrist 26. oktober 2026."], "issue_id": "200370"}'::jsonb, '{"key_facts": ["utlendingsloven", "familiegjenforening med barn", "Kommunal- og forvaltningskomiteen", "Erlend Wiborg"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-09', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200375.\n\nKildemateriale:\nProposisjon om lettelser i prospekt- og verdipapirregelverket og samtykke til en EØS-komitébeslutning om forordning (EU) 2024/2809. Behandles i finanskomiteen.", "source_texts": ["Proposisjon om lettelser i prospekt- og verdipapirregelverket og samtykke til en EØS-komitébeslutning om forordning (EU) 2024/2809. Behandles i finanskomiteen."], "issue_id": "200375"}'::jsonb, '{"key_facts": ["verdipapirhandelloven", "prospekt", "EØS-komiteen", "forordning (EU) 2024/2809", "Finanskomiteen"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-10', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200063.\n\nKildemateriale:\nRepresentantforslag fra FrP, H, Sp og KrF om å utsette innføringen av CO2-avgift for kjemisk reduksjon. Forslaget ble ikke vedtatt.", "source_texts": ["Representantforslag fra FrP, H, Sp og KrF om å utsette innføringen av CO2-avgift for kjemisk reduksjon. Forslaget ble ikke vedtatt."], "issue_id": "200063"}'::jsonb, '{"key_facts": ["CO2-avgift", "kjemisk reduksjon", "Fremskrittspartiet|FrP", "Høyre", "Senterpartiet|Sp", "Kristelig Folkeparti|KrF", "ikke vedtatt"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-11', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200084.\n\nKildemateriale:\nRepresentantforslag fra FrP om tiltak for å dempe økte energipriser og levekostnader. Forslaget ble ikke vedtatt.", "source_texts": ["Representantforslag fra FrP om tiltak for å dempe økte energipriser og levekostnader. Forslaget ble ikke vedtatt."], "issue_id": "200084"}'::jsonb, '{"key_facts": ["energipriser", "levekostnader", "Fremskrittspartiet|FrP", "Sylvi Listhaug", "Finanskomiteen", "ikke vedtatt"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-12', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200155.\n\nKildemateriale:\nRepresentantforslag fra Senterpartiet om lavere bensin- og dieselpriser. Forslaget ble ikke vedtatt.", "source_texts": ["Representantforslag fra Senterpartiet om lavere bensin- og dieselpriser. Forslaget ble ikke vedtatt."], "issue_id": "200155"}'::jsonb, '{"key_facts": ["bensin- og dieselpriser", "Senterpartiet|Sp", "Trygve Slagsvold Vedum", "Finanskomiteen", "ikke vedtatt"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-13', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200112.\n\nKildemateriale:\nRepresentantforslag fra KrF om en verifiserbar 18-årsgrense for porno på nettet. Forslaget ble ikke vedtatt.", "source_texts": ["Representantforslag fra KrF om en verifiserbar 18-årsgrense for porno på nettet. Forslaget ble ikke vedtatt."], "issue_id": "200112"}'::jsonb, '{"key_facts": ["18-årsgrense", "porno", "Kristelig Folkeparti|KrF", "Familie- og kulturkomiteen", "ikke vedtatt"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-14', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200211.\n\nKildemateriale:\nRepresentantforslag fra MDG om å dele ut statens inntekter fra klimaavgifter til befolkningen. Forslaget ble ikke vedtatt.", "source_texts": ["Representantforslag fra MDG om å dele ut statens inntekter fra klimaavgifter til befolkningen. Forslaget ble ikke vedtatt."], "issue_id": "200211"}'::jsonb, '{"key_facts": ["klimaavgifter", "befolkningen", "Miljøpartiet De Grønne|MDG", "Finanskomiteen", "ikke vedtatt"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-15', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200365.\n\nKildemateriale:\nRepresentantforslag fra FrP om å øke vektgrensen for førerkortklasse B. Til behandling i samferdselskomiteen.", "source_texts": ["Representantforslag fra FrP om å øke vektgrensen for førerkortklasse B. Til behandling i samferdselskomiteen."], "issue_id": "200365"}'::jsonb, '{"key_facts": ["vektgrensen", "førerkortklasse B", "Fremskrittspartiet|FrP", "Samferdselskomiteen", "Geir Inge Lien"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-16', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200363.\n\nKildemateriale:\nRepresentantforslag fra FrP om endringer i engangsavgiften for kjøretøy. Til behandling i finanskomiteen.", "source_texts": ["Representantforslag fra FrP om endringer i engangsavgiften for kjøretøy. Til behandling i finanskomiteen."], "issue_id": "200363"}'::jsonb, '{"key_facts": ["engangsavgiften", "kjøretøy", "Fremskrittspartiet|FrP", "Finanskomiteen"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-17', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200366.\n\nKildemateriale:\nRepresentantforslag fra KrF om å styrke ytringsfriheten for lærere. Til behandling i kommunal- og forvaltningskomiteen.", "source_texts": ["Representantforslag fra KrF om å styrke ytringsfriheten for lærere. Til behandling i kommunal- og forvaltningskomiteen."], "issue_id": "200366"}'::jsonb, '{"key_facts": ["ytringsfriheten", "lærere", "Kristelig Folkeparti|KrF", "Kommunal- og forvaltningskomiteen"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-18', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200321.\n\nKildemateriale:\nRepresentantforslag fra SV om tiltak mot kjønnslemlestelse. Til behandling i justiskomiteen, med høringsfrist 26. oktober 2026.", "source_texts": ["Representantforslag fra SV om tiltak mot kjønnslemlestelse. Til behandling i justiskomiteen, med høringsfrist 26. oktober 2026."], "issue_id": "200321"}'::jsonb, '{"key_facts": ["kjønnslemlestelse", "Sosialistisk Venstreparti|SV", "Justiskomiteen", "Marian Hussein"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-19', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200279.\n\nKildemateriale:\nRiksrevisjonen fant store variasjoner i avslag på henvisninger og ventetid, og mente det var kritikkverdig at Helse- og omsorgsdepartementet ikke i tilstrekkelig grad har sørget for at barn og unge med psykiske plager får hjelp. Komiteen sluttet seg til konklusjonene.", "source_texts": ["Riksrevisjonen fant store variasjoner i avslag på henvisninger og ventetid, og mente det var kritikkverdig at Helse- og omsorgsdepartementet ikke i tilstrekkelig grad har sørget for at barn og unge med psykiske plager får hjelp. Komiteen sluttet seg til konklusjonene."], "issue_id": "200279"}'::jsonb, '{"key_facts": ["Riksrevisjonen", "barn og unge", "psykiske plager", "ventetid", "kritikkverdig", "Helse- og omsorgsdepartementet", "Kontroll- og konstitusjonskomiteen"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active'),
('sak_summary', 'sak-20', '{"user_text": "Du skal lage et nøytralt AI-sammendrag (hva/hvem/kostnad) for stortingssak 200301.\n\nKildemateriale:\nRiksrevisjonen konkluderte med at dagens bruk av spesialisthelsetjenesten truer bærekraften til sykehusene, og at statlige virkemidler for behandling på rett nivå ikke har fungert godt nok. Komiteen sluttet seg til kritikken.", "source_texts": ["Riksrevisjonen konkluderte med at dagens bruk av spesialisthelsetjenesten truer bærekraften til sykehusene, og at statlige virkemidler for behandling på rett nivå ikke har fungert godt nok. Komiteen sluttet seg til kritikken."], "issue_id": "200301"}'::jsonb, '{"key_facts": ["Riksrevisjonen", "samhandling om eldre", "spesialisthelsetjenesten", "kommunene", "kritikkverdig", "Kontroll- og konstitusjonskomiteen"], "forbidden_numbers": [], "skal_avsta": false, "expected_chunk_ids": []}'::jsonb, 'golden', 'active')
ON CONFLICT (workflow_key, case_key) DO UPDATE SET
  input = EXCLUDED.input,
  expected = EXCLUDED.expected,
  origin = EXCLUDED.origin,
  status = EXCLUDED.status;

-- service_role only on n8n-facing RPCs (anon/authenticated revoked).
DO $$
DECLARE
  f regprocedure;
  v_names text[] := ARRAY[
    'n8n_get_active_prompt',
    'n8n_list_prompt_candidates',
    'n8n_list_eval_cases',
    'n8n_record_eval_run',
    'n8n_record_eval_result',
    'n8n_ai_weekly_metrics',
    'n8n_upsert_issue_ai_summary',
    'n8n_log_ai_generation',
    'n8n_propose_prompt_version'
  ];
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    FOR f IN
      SELECT p.oid::regprocedure FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname = v_name
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
  END LOOP;
END $$;

COMMIT;
