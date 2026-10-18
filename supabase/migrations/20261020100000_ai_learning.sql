-- AI learning instrumentation (phase 0–1): ai_* tables, triggers, prompt registry, n8n RPCs.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- Reason codes (shared)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_is_valid_reason_code(p_code text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_code IS NULL OR p_code IN (
    'sprak', 'faktafeil', 'ikke_noytral', 'duplikat', 'irrelevant', 'darlig_formulering',
    'for_lang', 'feil_sak', 'sensitivt', 'ikke_aksjon', 'annet'
  );
$$;

-- ---------------------------------------------------------------------------
-- ai_prompt_versions + approvers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key text NOT NULL CHECK (workflow_key IN (
    'reels_poll', 'candidate_rating', 'sak_summary', 'blog_outline', 'blog_section',
    'blog_rank', 'aksjon_classify', 'aksjon_draft', 'judge'
  )),
  node_key text NOT NULL DEFAULT 'system',
  version text NOT NULL,
  system_prompt text NOT NULL,
  user_template text,
  model text NOT NULL,
  model_options jsonb NOT NULL DEFAULT '{}'::jsonb,
  fewshot jsonb NOT NULL DEFAULT '{"k":0}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'candidate', 'active', 'retired', 'rejected'
  )),
  parent_id uuid REFERENCES public.ai_prompt_versions (id) ON DELETE SET NULL,
  change_note text,
  created_source text NOT NULL,
  eval_run_id uuid,
  approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at timestamptz,
  activated_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_key, node_key, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_prompt_one_active_idx
  ON public.ai_prompt_versions (workflow_key, node_key)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.ai_prompt_approvers (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- ai_generations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key text NOT NULL,
  n8n_workflow_id text,
  n8n_execution_id text,
  prompt_version_id uuid REFERENCES public.ai_prompt_versions (id) ON DELETE SET NULL,
  prompt_version text NOT NULL,
  model text NOT NULL,
  model_options jsonb,
  mode text NOT NULL DEFAULT 'prod' CHECK (mode IN ('prod', 'shadow', 'eval')),
  target_type text CHECK (target_type IN ('poll', 'issue_summary', 'blog_post', 'action_cluster')),
  target_id text,
  issue_id text,
  input_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_hash text,
  output jsonb NOT NULL,
  output_text text,
  guard_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text NOT NULL CHECK (outcome IN (
    'saved', 'dropped_guard', 'rejected_internal', 'llm_failed', 'duplicate', 'shadow_only'
  )),
  reject_reason text,
  latency_ms int,
  prompt_tokens int,
  eval_tokens int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_generations_workflow_created_idx
  ON public.ai_generations (workflow_key, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_generations_target_idx
  ON public.ai_generations (target_type, target_id);

-- ---------------------------------------------------------------------------
-- ai_feedback
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid REFERENCES public.ai_generations (id) ON DELETE SET NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  source text NOT NULL CHECK (source IN (
    'admin_ui', 'db_trigger', 'cms_hook', 'dryrun_label', 'regenerate', 'judge', 'import'
  )),
  decision text NOT NULL CHECK (decision IN (
    'approved', 'approved_with_edits', 'rejected', 'regenerated', 'flagged'
  )),
  reason_code text,
  reason_note text,
  before_json jsonb,
  after_json jsonb,
  before_text text,
  after_text text,
  edit_distance numeric(4, 3),
  edited_fields text[],
  decided_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  time_to_decision_s int,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_feedback_reason_code_check CHECK (public.ai_is_valid_reason_code(reason_code)),
  CONSTRAINT ai_feedback_reason_note_len CHECK (
    reason_note IS NULL OR char_length(reason_note) <= 300
  )
);

CREATE INDEX IF NOT EXISTS ai_feedback_target_idx
  ON public.ai_feedback (target_type, target_id, decided_at DESC);

-- ---------------------------------------------------------------------------
-- ai_eval_cases + ai_eval_runs + ai_eval_results
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_eval_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key text NOT NULL,
  case_key text NOT NULL,
  input jsonb NOT NULL,
  expected jsonb NOT NULL,
  reference_output jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  origin text NOT NULL CHECK (origin IN ('golden', 'from_rejection', 'from_edit', 'dryrun')),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'active', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_key, case_key)
);

CREATE TABLE IF NOT EXISTS public.ai_eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('weekly', 'regression', 'shadow')),
  prompt_version_id uuid REFERENCES public.ai_prompt_versions (id) ON DELETE SET NULL,
  baseline_version_id uuid REFERENCES public.ai_prompt_versions (id) ON DELETE SET NULL,
  model text NOT NULL,
  n_cases int,
  summary jsonb,
  verdict text CHECK (verdict IN ('better', 'same', 'worse', 'incomplete')),
  report_md text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.ai_eval_results (
  run_id uuid NOT NULL REFERENCES public.ai_eval_runs (id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.ai_eval_cases (id) ON DELETE CASCADE,
  variant text NOT NULL CHECK (variant IN ('baseline', 'candidate')),
  output jsonb,
  guard_hits jsonb,
  numbers_ok boolean,
  key_facts_recall numeric(4, 3),
  chunk_recall numeric(4, 3),
  judge jsonb,
  pairwise text CHECK (pairwise IN ('baseline', 'candidate', 'tie')),
  latency_ms int,
  PRIMARY KEY (run_id, case_id, variant)
);

-- ---------------------------------------------------------------------------
-- issue_ai_summaries metadata columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.issue_ai_summaries
  ADD COLUMN IF NOT EXISTS generation_id uuid REFERENCES public.ai_generations (id) ON DELETE SET NULL;

ALTER TABLE public.issue_ai_summaries
  ADD COLUMN IF NOT EXISTS prompt_version text;

ALTER TABLE public.issue_ai_summaries
  ADD COLUMN IF NOT EXISTS model text;

ALTER TABLE public.issue_ai_summaries
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Internal feedback writer (triggers + service_role RPCs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_internal_insert_feedback(
  p_generation_id uuid,
  p_target_type text,
  p_target_id text,
  p_source text,
  p_decision text,
  p_reason_code text,
  p_reason_note text,
  p_before_json jsonb,
  p_after_json jsonb,
  p_before_text text,
  p_after_text text,
  p_decided_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.ai_is_valid_reason_code(p_reason_code) THEN
    RAISE EXCEPTION 'Invalid reason_code';
  END IF;
  IF p_reason_note IS NOT NULL AND char_length(p_reason_note) > 300 THEN
    RAISE EXCEPTION 'reason_note too long';
  END IF;

  INSERT INTO public.ai_feedback (
    generation_id, target_type, target_id, source, decision,
    reason_code, reason_note, before_json, after_json, before_text, after_text, decided_by
  )
  VALUES (
    p_generation_id, p_target_type, p_target_id, p_source, p_decision,
    p_reason_code, left(p_reason_note, 300), p_before_json, p_after_json, p_before_text, p_after_text, p_decided_by
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_ai_feedback(
  p_target_type text,
  p_target_id text,
  p_source text,
  p_decision text,
  p_reason_code text DEFAULT NULL,
  p_reason_note text DEFAULT NULL,
  p_before_json jsonb DEFAULT NULL,
  p_after_json jsonb DEFAULT NULL,
  p_before_text text DEFAULT NULL,
  p_after_text text DEFAULT NULL,
  p_decided_by uuid DEFAULT NULL,
  p_generation_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.ai_feedback_skip', '1', true);
  RETURN public.ai_internal_insert_feedback(
    p_generation_id, p_target_type, p_target_id, p_source, p_decision,
    p_reason_code, p_reason_note, p_before_json, p_after_json, p_before_text, p_after_text, p_decided_by
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: issue_ai_summaries (before delete/update)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_trigger_issue_summary_preserve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(current_setting('app.ai_feedback_skip', true), '') = '1' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.ai_internal_insert_feedback(
      OLD.generation_id,
      'issue_summary',
      OLD.stortinget_issue_id,
      'db_trigger',
      'regenerated',
      NULL,
      NULL,
      to_jsonb(OLD),
      NULL,
      coalesce(OLD.narrative, OLD.hva),
      NULL,
      NULL
    );
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    OLD.hva IS DISTINCT FROM NEW.hva
    OR OLD.hvem IS DISTINCT FROM NEW.hvem
    OR OLD.kostnad IS DISTINCT FROM NEW.kostnad
    OR OLD.narrative IS DISTINCT FROM NEW.narrative
    OR OLD.who_affected IS DISTINCT FROM NEW.who_affected
    OR OLD.how_affected IS DISTINCT FROM NEW.how_affected
  ) THEN
    PERFORM public.ai_internal_insert_feedback(
      OLD.generation_id,
      'issue_summary',
      OLD.stortinget_issue_id,
      'db_trigger',
      'approved_with_edits',
      NULL,
      NULL,
      to_jsonb(OLD),
      to_jsonb(NEW),
      coalesce(OLD.narrative, OLD.hva),
      coalesce(NEW.narrative, NEW.hva),
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_issue_summary_preserve ON public.issue_ai_summaries;
CREATE TRIGGER ai_issue_summary_preserve
  BEFORE DELETE OR UPDATE ON public.issue_ai_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_trigger_issue_summary_preserve();

-- ---------------------------------------------------------------------------
-- Triggers: polls (after update)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_trigger_poll_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_decision text;
  v_reason text;
BEGIN
  IF coalesce(current_setting('app.ai_feedback_skip', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  v_reason := nullif(current_setting('app.ai_reason_code', true), '');

  IF OLD.status = 'draft' AND NEW.status = 'open' THEN
    IF OLD.title IS DISTINCT FROM NEW.title OR OLD.neutral_summary IS DISTINCT FROM NEW.neutral_summary THEN
      v_decision := 'approved_with_edits';
    ELSE
      v_decision := 'approved';
    END IF;
    PERFORM public.ai_internal_insert_feedback(
      NULL,
      'poll',
      NEW.id::text,
      'db_trigger',
      v_decision,
      v_reason,
      nullif(current_setting('app.ai_reason_note', true), ''),
      jsonb_build_object('title', OLD.title, 'neutral_summary', OLD.neutral_summary, 'status', OLD.status),
      jsonb_build_object('title', NEW.title, 'neutral_summary', NEW.neutral_summary, 'status', NEW.status),
      OLD.title || E'\n' || OLD.neutral_summary,
      NEW.title || E'\n' || NEW.neutral_summary,
      NULLIF(current_setting('app.ai_decided_by', true), '')::uuid
    );
  ELSIF OLD.status = 'draft' AND NEW.status = 'archived' THEN
    PERFORM public.ai_internal_insert_feedback(
      NULL,
      'poll',
      NEW.id::text,
      'db_trigger',
      'rejected',
      coalesce(v_reason, 'annet'),
      nullif(current_setting('app.ai_reason_note', true), ''),
      jsonb_build_object('title', OLD.title, 'neutral_summary', OLD.neutral_summary, 'status', OLD.status),
      jsonb_build_object('title', NEW.title, 'neutral_summary', NEW.neutral_summary, 'status', NEW.status),
      OLD.title || E'\n' || OLD.neutral_summary,
      NEW.title || E'\n' || NEW.neutral_summary,
      NULLIF(current_setting('app.ai_decided_by', true), '')::uuid
    );
  ELSIF OLD.status = 'draft' AND NEW.status = 'draft' AND (
    OLD.title IS DISTINCT FROM NEW.title OR OLD.neutral_summary IS DISTINCT FROM NEW.neutral_summary
  ) THEN
    PERFORM public.ai_internal_insert_feedback(
      NULL,
      'poll',
      NEW.id::text,
      'db_trigger',
      'approved_with_edits',
      v_reason,
      nullif(current_setting('app.ai_reason_note', true), ''),
      jsonb_build_object('title', OLD.title, 'neutral_summary', OLD.neutral_summary),
      jsonb_build_object('title', NEW.title, 'neutral_summary', NEW.neutral_summary),
      OLD.title || E'\n' || OLD.neutral_summary,
      NEW.title || E'\n' || NEW.neutral_summary,
      NULLIF(current_setting('app.ai_decided_by', true), '')::uuid
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_poll_feedback ON public.polls;
CREATE TRIGGER ai_poll_feedback
  AFTER UPDATE ON public.polls
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_trigger_poll_feedback();

-- ---------------------------------------------------------------------------
-- n8n_get_active_prompt (single-arg; 00200 replaces body — no (text,text) overload)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_get_active_prompt(p_workflow_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT to_jsonb(p)
  FROM public.ai_prompt_versions p
  WHERE p.workflow_key = p_workflow_key
    AND p.node_key = 'system'
    AND p.status = 'active'
  LIMIT 1;
$$;

DROP FUNCTION IF EXISTS public.n8n_get_active_prompt(text, text);

-- ---------------------------------------------------------------------------
-- n8n_log_ai_generation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_log_ai_generation(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.ai_generations (
    workflow_key,
    n8n_workflow_id,
    n8n_execution_id,
    prompt_version_id,
    prompt_version,
    model,
    model_options,
    mode,
    target_type,
    target_id,
    issue_id,
    input_refs,
    input_hash,
    output,
    output_text,
    guard_result,
    outcome,
    reject_reason,
    latency_ms,
    prompt_tokens,
    eval_tokens
  )
  VALUES (
    coalesce(p ->> 'workflow_key', 'unknown'),
    p ->> 'n8n_workflow_id',
    p ->> 'n8n_execution_id',
    (p ->> 'prompt_version_id')::uuid,
    coalesce(p ->> 'prompt_version', 'unknown'),
    coalesce(p ->> 'model', 'unknown'),
    coalesce(p -> 'model_options', '{}'::jsonb),
    coalesce(p ->> 'mode', 'prod'),
    p ->> 'target_type',
    p ->> 'target_id',
    p ->> 'issue_id',
    coalesce(p -> 'input_refs', '{}'::jsonb),
    p ->> 'input_hash',
    coalesce(p -> 'output', '{}'::jsonb),
    p ->> 'output_text',
    coalesce(p -> 'guard_result', '{}'::jsonb),
    coalesce(p ->> 'outcome', 'saved'),
    p ->> 'reject_reason',
    (p ->> 'latency_ms')::int,
    (p ->> 'prompt_tokens')::int,
    (p ->> 'eval_tokens')::int
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- n8n_propose_prompt_version (candidate only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_propose_prompt_version(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.ai_prompt_versions (
    workflow_key, node_key, version, system_prompt, user_template, model, model_options,
    fewshot, status, parent_id, change_note, created_source
  )
  VALUES (
    p ->> 'workflow_key',
    coalesce(nullif(btrim(p ->> 'node_key'), ''), 'system'),
    p ->> 'version',
    coalesce(p ->> 'system_prompt', ''),
    p ->> 'user_template',
    coalesce(p ->> 'model', 'unknown'),
    coalesce(p -> 'model_options', '{}'::jsonb),
    coalesce(p -> 'fewshot', '{"k":0}'::jsonb),
    'candidate',
    (p ->> 'parent_id')::uuid,
    p ->> 'change_note',
    coalesce(p ->> 'created_source', 'n8n_proposal')
  )
  ON CONFLICT (workflow_key, node_key, version) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    user_template = EXCLUDED.user_template,
    model = EXCLUDED.model,
    model_options = EXCLUDED.model_options,
    fewshot = EXCLUDED.fewshot,
    status = 'candidate',
    change_note = EXCLUDED.change_note
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_activate_prompt_version (authenticated admins only — NOT service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_activate_prompt_version(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.ai_prompt_versions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.ai_prompt_approvers a WHERE a.user_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'Not authorized to activate prompts';
  END IF;

  SELECT * INTO v_row FROM public.ai_prompt_versions WHERE id = p_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Prompt version not found';
  END IF;
  IF v_row.status NOT IN ('candidate', 'draft', 'retired') THEN
    RAISE EXCEPTION 'Prompt version cannot be activated from status %', v_row.status;
  END IF;

  UPDATE public.ai_prompt_versions
  SET status = 'retired', retired_at = now()
  WHERE workflow_key = v_row.workflow_key
    AND node_key = v_row.node_key
    AND status = 'active';

  UPDATE public.ai_prompt_versions
  SET
    status = 'active',
    approved_by = v_uid,
    approved_at = now(),
    activated_at = now(),
    retired_at = NULL
  WHERE id = p_id;

  RETURN p_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- n8n eval helpers (stubs for phase 2 wiring)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_list_eval_cases(p_workflow_key text)
RETURNS SETOF public.ai_eval_cases
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM public.ai_eval_cases
  WHERE workflow_key = p_workflow_key
    AND status = 'active'
  ORDER BY created_at;
$$;

CREATE OR REPLACE FUNCTION public.n8n_record_eval_run(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.ai_eval_runs (
    workflow_key, kind, prompt_version_id, baseline_version_id, model, n_cases, summary, verdict, report_md, finished_at
  )
  VALUES (
    p ->> 'workflow_key',
    coalesce(p ->> 'kind', 'weekly'),
    (p ->> 'prompt_version_id')::uuid,
    (p ->> 'baseline_version_id')::uuid,
    coalesce(p ->> 'model', 'unknown'),
    (p ->> 'n_cases')::int,
    p -> 'summary',
    p ->> 'verdict',
    p ->> 'report_md',
    (p ->> 'finished_at')::timestamptz
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS: ai_* tables — service_role only (admin reads via app service client)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_prompt_versions', 'ai_prompt_approvers', 'ai_generations', 'ai_feedback',
    'ai_eval_cases', 'ai_eval_runs', 'ai_eval_results'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- admin_poll_draft_action (single transaction: edit + feedback + publish/archive)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_poll_draft_action(
  p_poll_id uuid,
  p_action text,
  p_title text DEFAULT NULL,
  p_neutral_summary text DEFAULT NULL,
  p_reason_code text DEFAULT NULL,
  p_reason_note text DEFAULT NULL,
  p_decided_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old public.polls%ROWTYPE;
  v_new public.polls%ROWTYPE;
  v_decision text;
BEGIN
  IF p_action NOT IN ('publish', 'archive') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;
  IF p_action = 'archive' AND (p_reason_code IS NULL OR btrim(p_reason_code) = '') THEN
    RAISE EXCEPTION 'reason_code required for archive';
  END IF;
  IF NOT public.ai_is_valid_reason_code(p_reason_code) THEN
    RAISE EXCEPTION 'Invalid reason_code';
  END IF;

  SELECT * INTO v_old FROM public.polls WHERE id = p_poll_id;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;
  IF v_old.status <> 'draft' THEN
    RAISE EXCEPTION 'Poll is not a draft';
  END IF;

  PERFORM set_config('app.ai_feedback_skip', '1', true);
  PERFORM set_config('app.ai_reason_code', coalesce(p_reason_code, ''), true);
  PERFORM set_config('app.ai_reason_note', coalesce(left(p_reason_note, 300), ''), true);
  PERFORM set_config('app.ai_decided_by', coalesce(p_decided_by::text, ''), true);

  UPDATE public.polls
  SET
    title = coalesce(nullif(btrim(p_title), ''), title),
    neutral_summary = coalesce(p_neutral_summary, neutral_summary),
    updated_at = now()
  WHERE id = p_poll_id
  RETURNING * INTO v_new;

  IF p_action = 'publish' THEN
    IF v_old.title IS DISTINCT FROM v_new.title OR v_old.neutral_summary IS DISTINCT FROM v_new.neutral_summary THEN
      v_decision := 'approved_with_edits';
    ELSE
      v_decision := 'approved';
    END IF;
    PERFORM public.ai_internal_insert_feedback(
      NULL, 'poll', p_poll_id::text, 'admin_ui', v_decision,
      p_reason_code, left(p_reason_note, 300),
      jsonb_build_object('title', v_old.title, 'neutral_summary', v_old.neutral_summary),
      jsonb_build_object('title', v_new.title, 'neutral_summary', v_new.neutral_summary),
      v_old.title || E'\n' || v_old.neutral_summary,
      v_new.title || E'\n' || v_new.neutral_summary,
      p_decided_by
    );
    PERFORM public.publish_poll(p_poll_id);
  ELSE
    PERFORM public.ai_internal_insert_feedback(
      NULL, 'poll', p_poll_id::text, 'admin_ui', 'rejected',
      p_reason_code, left(p_reason_note, 300),
      jsonb_build_object('title', v_old.title, 'neutral_summary', v_old.neutral_summary, 'status', v_old.status),
      jsonb_build_object('status', 'archived'),
      v_old.title || E'\n' || v_old.neutral_summary,
      NULL,
      p_decided_by
    );
    PERFORM public.archive_poll(p_poll_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_poll_id, 'action', p_action);
END;
$$;

-- ---------------------------------------------------------------------------
-- Lock down functions
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  f regprocedure;
  v_n8n text[] := ARRAY[
    'n8n_get_active_prompt', 'n8n_log_ai_generation', 'n8n_propose_prompt_version',
    'n8n_list_eval_cases', 'n8n_record_eval_run', 'record_ai_feedback',
    'ai_internal_insert_feedback', 'admin_poll_draft_action'
  ];
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY v_n8n
  LOOP
    FOR f IN
      SELECT p.oid::regprocedure FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
  END LOOP;

  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_activate_prompt_version'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;

  FOREACH v_name IN ARRAY ARRAY[
    'ai_is_valid_reason_code',
    'ai_trigger_issue_summary_preserve',
    'ai_trigger_poll_feedback'
  ]
  LOOP
    FOR f IN
      SELECT p.oid::regprocedure FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    END LOOP;
  END LOOP;
END $$;

-- migration-sql-lint: static RLS/REVOKE (runtime lockdown uses DO blocks above).
ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_eval_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_eval_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION public.ai_is_valid_reason_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_internal_insert_feedback(uuid, text, text, text, text, text, text, jsonb, jsonb, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_ai_feedback(text, text, text, text, text, text, jsonb, jsonb, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_trigger_issue_summary_preserve() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_trigger_poll_feedback() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_get_active_prompt(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_log_ai_generation(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_propose_prompt_version(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_activate_prompt_version(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_list_eval_cases(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_record_eval_run(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_poll_draft_action(uuid, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
