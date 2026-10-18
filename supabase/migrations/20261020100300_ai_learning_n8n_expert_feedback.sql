-- N8N Expert review follow-up (PR #171 §5.2–5.3).

BEGIN;

-- blog_draft prompt registry (blog genmeta prompt_id)
ALTER TABLE public.ai_prompt_versions
  DROP CONSTRAINT IF EXISTS ai_prompt_versions_workflow_key_check;

ALTER TABLE public.ai_prompt_versions
  ADD CONSTRAINT ai_prompt_versions_workflow_key_check CHECK (workflow_key IN (
    'reels_poll', 'candidate_rating', 'sak_summary', 'blog_outline', 'blog_section',
    'blog_rank', 'blog_draft', 'aksjon_classify', 'aksjon_draft', 'judge'
  ));

ALTER TABLE public.ai_eval_cases
  DROP CONSTRAINT IF EXISTS ai_eval_cases_origin_check;

ALTER TABLE public.ai_eval_cases
  ADD CONSTRAINT ai_eval_cases_origin_check CHECK (origin IN (
    'golden', 'golden_draft', 'from_rejection', 'from_edit', 'dryrun'
  ));

ALTER TABLE public.ai_eval_cases
  DROP CONSTRAINT IF EXISTS ai_eval_cases_status_check;

ALTER TABLE public.ai_eval_cases
  ADD CONSTRAINT ai_eval_cases_status_check CHECK (status IN (
    'proposed', 'active', 'retired', 'draft'
  ));

ALTER TABLE public.ai_feedback
  DROP CONSTRAINT IF EXISTS ai_feedback_source_check;

ALTER TABLE public.ai_feedback
  ADD CONSTRAINT ai_feedback_source_check CHECK (source IN (
    'admin_ui', 'db_trigger', 'cms_hook', 'dryrun_label', 'regenerate', 'judge', 'import', 'n8n'
  ));

UPDATE public.ai_eval_cases
SET origin = 'golden_draft', status = 'draft'
WHERE workflow_key = 'sak_summary'
  AND case_key LIKE 'sak-%'
  AND origin = 'golden'
  AND status = 'active';

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
  v_old public.issue_ai_summaries%ROWTYPE;
  v_new public.issue_ai_summaries%ROWTYPE;
  v_feedback_generation_id uuid;
BEGIN
  v_generation_id := nullif(v_meta ->> 'generation_id', '')::uuid;
  v_feedback_generation_id := v_generation_id;

  PERFORM set_config('app.ai_feedback_skip', '1', true);

  SELECT * INTO v_old
  FROM public.issue_ai_summaries
  WHERE stortinget_issue_id = p_issue_id;

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
    updated_at = now()
  RETURNING * INTO v_new;

  UPDATE public.stortinget_issues
  SET ai_labels = v_labels
  WHERE id = p_issue_id;

  IF v_old.stortinget_issue_id IS NOT NULL
    AND (
      v_old.hva IS DISTINCT FROM v_new.hva
      OR v_old.hvem IS DISTINCT FROM v_new.hvem
      OR v_old.kostnad IS DISTINCT FROM v_new.kostnad
      OR v_old.narrative IS DISTINCT FROM v_new.narrative
      OR v_old.who_affected IS DISTINCT FROM v_new.who_affected
      OR v_old.how_affected IS DISTINCT FROM v_new.how_affected
    )
  THEN
    v_feedback_generation_id := coalesce(v_generation_id, v_old.generation_id, v_new.generation_id);
    PERFORM public.ai_internal_insert_feedback(
      v_feedback_generation_id,
      'issue_summary',
      p_issue_id,
      'n8n',
      'regenerated',
      NULL,
      NULL,
      to_jsonb(v_old),
      to_jsonb(v_new),
      coalesce(v_old.narrative, v_old.hva),
      coalesce(v_new.narrative, v_new.hva),
      NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'stortinget_issue_id', p_issue_id,
    'generation_id', v_feedback_generation_id
  );
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
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
    RAISE EXCEPTION 'Invalid period';
  END IF;

  WITH gen_rows AS (
    SELECT
      g.workflow_key,
      g.prompt_version,
      g.id AS generation_id,
      g.latency_ms,
      g.outcome,
      lf.decision,
      lf.edit_distance
    FROM public.ai_generations g
    LEFT JOIN LATERAL (
      SELECT f.decision, f.edit_distance
      FROM public.ai_feedback f
      WHERE f.decided_at >= p_from AND f.decided_at < p_to
        AND (
          f.generation_id = g.id
          OR (
            f.generation_id IS NULL
            AND g.target_type IS NOT NULL
            AND f.target_type = g.target_type
            AND f.target_id = g.target_id
          )
        )
      ORDER BY f.decided_at DESC
      LIMIT 1
    ) lf ON true
    WHERE g.created_at >= p_from AND g.created_at < p_to
      AND g.mode = 'prod'
  ),
  poll_orphan_rows AS (
    SELECT
      'reels_poll'::text AS workflow_key,
      coalesce(
        p.generation_metadata->'genmeta'->>'prompt_version',
        p.generation_metadata->>'prompt_version',
        'unknown'
      ) AS prompt_version,
      p.id AS generation_id,
      NULL::int AS latency_ms,
      NULL::text AS outcome,
      lf.decision,
      lf.edit_distance
    FROM public.polls p
    INNER JOIN LATERAL (
      SELECT f.decision, f.edit_distance
      FROM public.ai_feedback f
      WHERE f.target_type = 'poll'
        AND f.target_id = p.id::text
        AND f.decided_at >= p_from AND f.decided_at < p_to
        AND f.generation_id IS NULL
      ORDER BY f.decided_at DESC
      LIMIT 1
    ) lf ON true
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.ai_generations g
      WHERE g.created_at >= p_from AND g.created_at < p_to
        AND g.mode = 'prod'
        AND (
          g.id = nullif(p.generation_metadata->>'generation_id', '')::uuid
          OR (g.target_type = 'poll' AND g.target_id = p.id::text)
        )
    )
  ),
  all_rows AS (
    SELECT * FROM gen_rows
    UNION ALL
    SELECT * FROM poll_orphan_rows
  )
  SELECT coalesce(jsonb_agg(row_data ORDER BY workflow_key, prompt_version), '[]'::jsonb)
  INTO v_workflows
  FROM (
    SELECT
      jsonb_build_object(
        'workflow_key', ar.workflow_key,
        'prompt_version', ar.prompt_version,
        'generations', count(DISTINCT ar.generation_id)::int,
        'approved', count(DISTINCT ar.generation_id) FILTER (
          WHERE ar.decision = 'approved'
        )::int,
        'approved_with_edits', count(DISTINCT ar.generation_id) FILTER (
          WHERE ar.decision = 'approved_with_edits'
        )::int,
        'rejected', count(DISTINCT ar.generation_id) FILTER (
          WHERE ar.decision = 'rejected'
        )::int,
        'regenerated', count(DISTINCT ar.generation_id) FILTER (
          WHERE ar.decision = 'regenerated'
        )::int,
        'edit_distance_median', percentile_cont(0.5) WITHIN GROUP (
          ORDER BY ar.edit_distance
        ) FILTER (WHERE ar.edit_distance IS NOT NULL),
        'guard_hits_per_1000_words', NULL,
        'dropped_guard', count(DISTINCT ar.generation_id) FILTER (
          WHERE ar.outcome = 'dropped_guard'
        )::int,
        'llm_failed', count(DISTINCT ar.generation_id) FILTER (
          WHERE ar.outcome = 'llm_failed'
        )::int,
        'latency_p50_ms', percentile_cont(0.5) WITHIN GROUP (
          ORDER BY ar.latency_ms
        ) FILTER (WHERE ar.latency_ms IS NOT NULL),
        'reason_codes', coalesce((
          SELECT jsonb_object_agg(reason_code, cnt)
          FROM (
            SELECT f.reason_code, count(*)::int AS cnt
            FROM public.ai_feedback f
            LEFT JOIN public.ai_generations g2 ON g2.id = f.generation_id
            LEFT JOIN public.polls p2
              ON f.target_type = 'poll' AND p2.id::text = f.target_id
            WHERE f.reason_code IS NOT NULL
              AND f.decided_at >= p_from AND f.decided_at < p_to
              AND coalesce(
                g2.workflow_key,
                CASE WHEN f.target_type = 'poll' THEN 'reels_poll' END,
                CASE WHEN f.target_type = 'issue_summary' THEN 'sak_summary' END
              ) = ar.workflow_key
              AND coalesce(
                g2.prompt_version,
                p2.generation_metadata->'genmeta'->>'prompt_version',
                p2.generation_metadata->>'prompt_version'
              ) IS NOT DISTINCT FROM ar.prompt_version
            GROUP BY f.reason_code
          ) rc
        ), '{}'::jsonb),
        'baseline_4w', NULL
      ) AS row_data,
      ar.workflow_key,
      ar.prompt_version
    FROM all_rows ar
    GROUP BY ar.workflow_key, ar.prompt_version
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

DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.proname IN ('n8n_upsert_issue_ai_summary', 'n8n_ai_weekly_metrics')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
