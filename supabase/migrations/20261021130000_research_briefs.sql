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

CREATE OR REPLACE FUNCTION public.n8n_upsert_research_brief(
  p_request_id uuid,
  p_status text,
  p_summary text DEFAULT NULL,
  p_perspectives jsonb DEFAULT '[]'::jsonb,
  p_sources jsonb DEFAULT '[]'::jsonb,
  p_error text DEFAULT NULL
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

  p_status := btrim(p_status);
  IF p_status IS NULL
    OR p_status NOT IN ('queued', 'running', 'done', 'failed') THEN
    RAISE EXCEPTION 'research_brief invalid_status: ugyldig status %', p_status
      USING ERRCODE = '22023';
  END IF;

  IF p_perspectives IS NULL OR jsonb_typeof(p_perspectives) <> 'array' THEN
    RAISE EXCEPTION 'research_brief invalid_perspectives: må være JSON-array'
      USING ERRCODE = '22023';
  END IF;

  IF p_sources IS NULL OR jsonb_typeof(p_sources) <> 'array' THEN
    RAISE EXCEPTION 'research_brief invalid_sources: må være JSON-array'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.research_briefs
  SET
    status = p_status,
    summary = COALESCE(p_summary, summary),
    perspectives = p_perspectives,
    sources = p_sources,
    error = p_error,
    updated_at = now()
  WHERE request_id = p_request_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'research_brief not_found: ingen brief med request_id=%', p_request_id
      USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_row.request_id,
    'status', v_row.status
  );
END;
$$;

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

  UPDATE public.research_briefs
  SET
    output_ref = p_output_ref,
    status = 'done',
    error = NULL,
    updated_at = now()
  WHERE request_id = p_request_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'research_brief not_found: ingen brief med request_id=%', p_request_id
      USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_row.request_id,
    'output_ref', v_row.output_ref,
    'status', v_row.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_upsert_research_brief(uuid, text, text, jsonb, jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.n8n_set_research_output(uuid, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.n8n_upsert_research_brief(uuid, text, text, jsonb, jsonb, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.n8n_set_research_output(uuid, text)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
