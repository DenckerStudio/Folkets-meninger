-- Research-briefs for admin Research (n8n + fm-web). Manuell apply på prod.
-- Fremtidige embedding-kolonner: standard bge-m3 → vector(1024) (samme som resten av repoet).

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.research_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  cluster_id uuid NOT NULL REFERENCES public.action_clusters (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('deepen', 'blog', 'reel')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  summary text,
  perspectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_ref text,
  error text,
  requested_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_briefs_cluster_created_idx
  ON public.research_briefs (cluster_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.research_briefs_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.research_briefs_set_updated_at()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS research_briefs_updated_at ON public.research_briefs;
CREATE TRIGGER research_briefs_updated_at
  BEFORE UPDATE ON public.research_briefs
  FOR EACH ROW
  EXECUTE FUNCTION public.research_briefs_set_updated_at();

REVOKE ALL ON TABLE public.research_briefs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.research_briefs TO service_role;
GRANT SELECT ON TABLE public.research_briefs TO authenticated;

ALTER TABLE public.research_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_briefs_admin_select ON public.research_briefs;
CREATE POLICY research_briefs_admin_select ON public.research_briefs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.research_brief_row_to_jsonb(p_row public.research_briefs)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'id', p_row.id,
    'request_id', p_row.request_id,
    'cluster_id', p_row.cluster_id,
    'kind', p_row.kind,
    'status', p_row.status,
    'summary', p_row.summary,
    'perspectives', p_row.perspectives,
    'sources', p_row.sources,
    'details', p_row.details,
    'output_ref', p_row.output_ref,
    'error', p_row.error,
    'requested_by', p_row.requested_by,
    'created_at', p_row.created_at,
    'updated_at', p_row.updated_at
  );
$$;

REVOKE ALL ON FUNCTION public.research_brief_row_to_jsonb(public.research_briefs)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.research_briefs_validate_perspectives(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'array' THEN
    RETURN false;
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_value)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RETURN false;
    END IF;
    IF NOT (v_item ? 'actor' AND v_item ? 'actor_type' AND v_item ? 'stance' AND v_item ? 'summary') THEN
      RETURN false;
    END IF;
    IF v_item ? 'quotes' AND jsonb_typeof(v_item -> 'quotes') <> 'array' THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.research_briefs_validate_perspectives(jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.research_briefs_validate_sources(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'array' THEN
    RETURN false;
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_value)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' OR NOT (v_item ? 'url') THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.research_briefs_validate_sources(jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.research_brief_status_rank(p_status text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_status
    WHEN 'queued' THEN 1
    WHEN 'running' THEN 2
    WHEN 'done' THEN 3
    WHEN 'failed' THEN 3
    ELSE 0
  END;
$$;

REVOKE ALL ON FUNCTION public.research_brief_status_rank(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.research_briefs_is_backwards_status(
  p_current text,
  p_next text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    p_current IS DISTINCT FROM p_next
    AND (
      public.research_brief_status_rank(p_current) > public.research_brief_status_rank(p_next)
      OR (p_current IN ('done', 'failed') AND p_next IS DISTINCT FROM p_current)
    );
$$;

REVOKE ALL ON FUNCTION public.research_briefs_is_backwards_status(text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.research_briefs_expire_stale(p_minutes int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  IF p_minutes IS NULL OR p_minutes < 1 THEN
    RAISE EXCEPTION 'research_brief invalid_minutes: p_minutes må være >= 1'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.research_briefs
  SET
    status = 'failed',
    error = 'tidsavbrudd',
    updated_at = now()
  WHERE status IN ('queued', 'running')
    AND updated_at < now() - make_interval(mins => p_minutes);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.research_briefs_expire_stale(int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.research_briefs_expire_stale(int) TO service_role;

CREATE OR REPLACE FUNCTION public.n8n_get_research_brief(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.research_briefs%ROWTYPE;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'research_brief missing_request_id: p_request_id er påkrevd'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row
  FROM public.research_briefs
  WHERE request_id = p_request_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'request_id', v_row.request_id,
    'cluster_id', v_row.cluster_id,
    'kind', v_row.kind,
    'status', v_row.status,
    'summary', v_row.summary,
    'details', v_row.details,
    'perspectives', v_row.perspectives,
    'sources', v_row.sources,
    'output_ref', v_row.output_ref,
    'error', v_row.error,
    'requested_by', v_row.requested_by,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_get_research_brief(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_get_research_brief(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.n8n_upsert_research_brief(
  p_request_id uuid,
  p_status text DEFAULT NULL,
  p_summary text DEFAULT NULL,
  p_perspectives jsonb DEFAULT NULL,
  p_sources jsonb DEFAULT NULL,
  p_details jsonb DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.research_briefs%ROWTYPE;
  v_next_status text;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'research_brief missing_request_id: p_request_id er påkrevd'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row
  FROM public.research_briefs
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found', 'request_id', p_request_id);
  END IF;

  v_next_status := v_row.status;
  IF p_status IS NOT NULL THEN
    p_status := btrim(p_status);
    IF p_status NOT IN ('queued', 'running', 'done', 'failed') THEN
      RAISE EXCEPTION 'research_brief invalid_status: ugyldig status %', p_status
        USING ERRCODE = '22023';
    END IF;
    IF public.research_briefs_is_backwards_status(v_row.status, p_status) THEN
      RETURN public.research_brief_row_to_jsonb(v_row);
    END IF;
    v_next_status := p_status;
  END IF;

  IF p_perspectives IS NOT NULL
    AND NOT public.research_briefs_validate_perspectives(p_perspectives) THEN
    RAISE EXCEPTION 'research_brief invalid_perspectives: må være array med påkrevde felt'
      USING ERRCODE = '22023';
  END IF;

  IF p_sources IS NOT NULL
    AND NOT public.research_briefs_validate_sources(p_sources) THEN
    RAISE EXCEPTION 'research_brief invalid_sources: må være array med url'
      USING ERRCODE = '22023';
  END IF;

  IF p_details IS NOT NULL AND jsonb_typeof(p_details) <> 'object' THEN
    RAISE EXCEPTION 'research_brief invalid_details: må være JSON-objekt'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.research_briefs
  SET
    status = v_next_status,
    summary = COALESCE(p_summary, summary),
    perspectives = COALESCE(p_perspectives, perspectives),
    sources = COALESCE(p_sources, sources),
    details = COALESCE(p_details, details),
    error = COALESCE(p_error, error),
    updated_at = now()
  WHERE request_id = p_request_id
  RETURNING * INTO v_row;

  RETURN public.research_brief_row_to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_upsert_research_brief(uuid, text, text, jsonb, jsonb, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_upsert_research_brief(uuid, text, text, jsonb, jsonb, jsonb, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.n8n_set_research_output(
  p_request_id uuid,
  p_output_ref text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.research_briefs%ROWTYPE;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'research_brief missing_request_id: p_request_id er påkrevd'
      USING ERRCODE = '22023';
  END IF;

  p_output_ref := nullif(btrim(p_output_ref), '');
  IF p_output_ref IS NULL THEN
    RAISE EXCEPTION 'research_brief missing_output_ref: p_output_ref er påkrevd'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row
  FROM public.research_briefs
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found', 'request_id', p_request_id);
  END IF;

  IF v_row.status = 'done' AND v_row.output_ref IS NOT NULL THEN
    IF v_row.output_ref = p_output_ref THEN
      RETURN public.research_brief_row_to_jsonb(v_row);
    END IF;
    RETURN public.research_brief_row_to_jsonb(v_row);
  END IF;

  IF v_row.status = 'failed' THEN
    RETURN public.research_brief_row_to_jsonb(v_row);
  END IF;

  UPDATE public.research_briefs
  SET
    output_ref = p_output_ref,
    status = 'done',
    error = NULL,
    updated_at = now()
  WHERE request_id = p_request_id
  RETURNING * INTO v_row;

  RETURN public.research_brief_row_to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_set_research_output(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_set_research_output(uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.n8n_create_research_reel_draft(
  p_request_id uuid,
  p_issue_id text,
  p_title text,
  p_neutral_summary text,
  p_source_urls jsonb,
  p_generation_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.research_briefs%ROWTYPE;
  v_poll_id uuid;
  v_meta jsonb;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'research_brief missing_request_id: p_request_id er påkrevd'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row
  FROM public.research_briefs
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'research_brief not_found: ukjent request_id %', p_request_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_row.kind <> 'reel' THEN
    RAISE EXCEPTION 'research_brief invalid_kind: forventet reel, fikk %', v_row.kind
      USING ERRCODE = '22023';
  END IF;

  IF v_row.output_ref IS NOT NULL AND btrim(v_row.output_ref) <> '' THEN
    RETURN jsonb_build_object(
      'poll_id', v_row.output_ref::uuid,
      'created', false
    );
  END IF;

  v_meta := coalesce(p_generation_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'origin', 'research',
      'research_request_id', p_request_id::text
    );

  v_poll_id := public.create_system_poll_draft(
    p_issue_id,
    p_title,
    coalesce(p_neutral_summary, ''),
    coalesce(p_source_urls, '[]'::jsonb),
    v_meta
  );

  UPDATE public.research_briefs
  SET
    output_ref = v_poll_id::text,
    status = 'done',
    error = NULL,
    updated_at = now()
  WHERE request_id = p_request_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'poll_id', v_poll_id,
    'created', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_create_research_reel_draft(uuid, text, text, text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_create_research_reel_draft(uuid, text, text, text, jsonb, jsonb)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
