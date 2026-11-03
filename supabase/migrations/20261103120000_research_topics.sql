-- Admin Research tema-brief («Bruk funn»). Manuell apply på prod.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.research_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL CHECK (source_kind IN ('cluster', 'reddit')),
  cluster_id uuid REFERENCES public.action_clusters (id) ON DELETE CASCADE,
  reddit_signal_id uuid REFERENCES public.reddit_signals (id) ON DELETE CASCADE,
  title text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  request_id text NOT NULL UNIQUE,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  publishable boolean,
  blocking_reason text,
  error text,
  heartbeat_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_topics_source_cluster CHECK (
    (source_kind = 'cluster' AND cluster_id IS NOT NULL AND reddit_signal_id IS NULL)
    OR (source_kind = 'reddit' AND reddit_signal_id IS NOT NULL AND cluster_id IS NULL)
  ),
  CONSTRAINT research_topics_cluster_title CHECK (
    source_kind <> 'cluster'
    OR (title IS NOT NULL AND char_length(btrim(title)) >= 1 AND char_length(title) <= 500)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS research_topics_one_per_cluster_idx
  ON public.research_topics (cluster_id)
  WHERE cluster_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS research_topics_one_per_reddit_idx
  ON public.research_topics (reddit_signal_id)
  WHERE reddit_signal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS research_topics_status_heartbeat_idx
  ON public.research_topics (status, heartbeat_at DESC NULLS LAST);

CREATE OR REPLACE FUNCTION public.research_topics_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.research_topics_set_updated_at()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS research_topics_updated_at ON public.research_topics;
CREATE TRIGGER research_topics_updated_at
  BEFORE UPDATE ON public.research_topics
  FOR EACH ROW
  EXECUTE FUNCTION public.research_topics_set_updated_at();

ALTER TABLE public.research_topics ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.research_topics FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.research_topics TO service_role;
GRANT SELECT ON TABLE public.research_topics TO authenticated;

DROP POLICY IF EXISTS research_topics_admin_select ON public.research_topics;
CREATE POLICY research_topics_admin_select ON public.research_topics
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.research_topics_raise_invalid_input(p_field text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'research_topic_invalid_input: %', p_field
    USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public.research_topics_raise_invalid_input(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.research_topics_is_backwards_status(p_current text, p_next text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_current = 'done' OR p_current = 'failed' THEN true
    WHEN p_current = 'running' AND p_next = 'queued' THEN true
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.research_topics_is_backwards_status(text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.research_topics_normalize_error(p_error text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE btrim(coalesce(p_error, ''))
    WHEN '' THEN NULL
    WHEN 'modell_feil' THEN 'modell_feil'
    WHEN 'ugyldig_svar' THEN 'ugyldig_svar'
    WHEN 'henting_feil' THEN 'henting_feil'
    WHEN 'tema_mangler' THEN 'tema_mangler'
    ELSE 'ukjent_feil'
  END;
$$;

REVOKE ALL ON FUNCTION public.research_topics_normalize_error(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.research_topics_expire_stale(p_minutes int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  IF p_minutes IS NULL OR p_minutes < 1 THEN
    PERFORM public.research_topics_raise_invalid_input('p_minutes');
  END IF;

  UPDATE public.research_topics
  SET
    status = 'failed',
    error = 'ukjent_feil',
    updated_at = now()
  WHERE status IN ('queued', 'running')
    AND coalesce(heartbeat_at, updated_at) < now() - make_interval(mins => p_minutes);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.research_topics_expire_stale(int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.research_topics_expire_stale(int) TO service_role;

CREATE OR REPLACE FUNCTION public.research_topics_request_brief(
  p_request_id text,
  p_source_kind text,
  p_cluster_id uuid,
  p_reddit_signal_id uuid,
  p_title text,
  p_created_by uuid,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.research_topics%ROWTYPE;
  v_existing public.research_topics%ROWTYPE;
  v_request_id text;
  v_stored_title text;
BEGIN
  v_request_id := btrim(p_request_id);
  IF v_request_id IS NULL OR v_request_id = '' THEN
    PERFORM public.research_topics_raise_invalid_input('request_id');
  END IF;
  IF p_source_kind IS NULL OR p_source_kind NOT IN ('cluster', 'reddit') THEN
    PERFORM public.research_topics_raise_invalid_input('source_kind');
  END IF;
  IF p_source_kind = 'cluster' AND p_cluster_id IS NULL THEN
    PERFORM public.research_topics_raise_invalid_input('cluster_id');
  END IF;
  IF p_source_kind = 'reddit' AND p_reddit_signal_id IS NULL THEN
    PERFORM public.research_topics_raise_invalid_input('reddit_signal_id');
  END IF;

  v_stored_title := NULLIF(left(btrim(coalesce(p_title, '')), 500), '');

  SELECT * INTO v_existing
  FROM public.research_topics
  WHERE request_id = v_request_id;

  IF FOUND THEN
    IF v_existing.source_kind IS DISTINCT FROM p_source_kind
      OR v_existing.cluster_id IS DISTINCT FROM p_cluster_id
      OR v_existing.reddit_signal_id IS DISTINCT FROM p_reddit_signal_id THEN
      RAISE EXCEPTION 'research_topic_request_conflict'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'topic_id', v_existing.id,
      'request_id', v_existing.request_id,
      'status', v_existing.status,
      'publishable', v_existing.publishable,
      'created', false,
      'enqueue', false
    );
  END IF;

  IF p_source_kind = 'cluster' THEN
    SELECT * INTO v_existing
    FROM public.research_topics
    WHERE cluster_id = p_cluster_id;
  ELSE
    SELECT * INTO v_existing
    FROM public.research_topics
    WHERE reddit_signal_id = p_reddit_signal_id;
  END IF;

  IF FOUND THEN
    IF NOT p_force AND v_existing.status IN ('done', 'queued', 'running') THEN
      RETURN jsonb_build_object(
        'topic_id', v_existing.id,
        'request_id', v_existing.request_id,
        'status', v_existing.status,
        'publishable', v_existing.publishable,
        'created', false,
        'enqueue', false
      );
    END IF;

    UPDATE public.research_topics
    SET
      request_id = v_request_id,
      title = CASE
        WHEN p_source_kind = 'cluster' THEN coalesce(v_stored_title, title)
        ELSE coalesce(v_stored_title, title)
      END,
      previous_output = CASE
        WHEN p_force AND output <> '{}'::jsonb THEN output
        ELSE previous_output
      END,
      status = 'queued',
      output = '{}'::jsonb,
      publishable = NULL,
      blocking_reason = NULL,
      error = NULL,
      heartbeat_at = NULL,
      started_at = NULL,
      finished_at = NULL,
      created_by = COALESCE(p_created_by, created_by),
      updated_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
      'topic_id', v_row.id,
      'request_id', v_row.request_id,
      'status', v_row.status,
      'publishable', v_row.publishable,
      'created', false,
      'enqueue', true
    );
  END IF;

  IF p_source_kind = 'cluster' AND v_stored_title IS NULL THEN
    PERFORM public.research_topics_raise_invalid_input('title');
  END IF;

  INSERT INTO public.research_topics (
    source_kind,
    cluster_id,
    reddit_signal_id,
    title,
    status,
    request_id,
    created_by
  )
  VALUES (
    p_source_kind,
    p_cluster_id,
    p_reddit_signal_id,
    v_stored_title,
    'queued',
    v_request_id,
    p_created_by
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'topic_id', v_row.id,
    'request_id', v_row.request_id,
    'status', v_row.status,
    'publishable', v_row.publishable,
    'created', true,
    'enqueue', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.research_topics_request_brief(text, text, uuid, uuid, text, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.research_topics_request_brief(text, text, uuid, uuid, text, uuid, boolean)
  TO service_role;

CREATE OR REPLACE FUNCTION public.n8n_get_research_topic(p_topic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.research_topics%ROWTYPE;
  v_source jsonb := '{}'::jsonb;
  v_rs public.reddit_signals%ROWTYPE;
  v_cluster public.action_clusters%ROWTYPE;
BEGIN
  IF p_topic_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  SELECT * INTO v_row
  FROM public.research_topics
  WHERE id = p_topic_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF v_row.source_kind = 'reddit' AND v_row.reddit_signal_id IS NOT NULL THEN
    SELECT * INTO v_rs
    FROM public.reddit_signals
    WHERE id = v_row.reddit_signal_id;
    IF FOUND THEN
      v_source := jsonb_build_object(
        'kind', 'reddit',
        'reddit_id', v_rs.reddit_id,
        'subreddit', v_rs.subreddit,
        'permalink', v_rs.url
      );
    END IF;
  ELSIF v_row.source_kind = 'cluster' AND v_row.cluster_id IS NOT NULL THEN
    SELECT * INTO v_cluster
    FROM public.action_clusters
    WHERE id = v_row.cluster_id;
    IF FOUND THEN
      v_source := jsonb_build_object(
        'kind', 'cluster',
        'cluster_id', v_cluster.id,
        'action_key', v_cluster.action_key,
        'action_name', v_cluster.action_name,
        'description_nb', v_cluster.description_nb
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'topic', jsonb_build_object(
      'id', v_row.id,
      'source_kind', v_row.source_kind,
      'cluster_id', v_row.cluster_id,
      'reddit_signal_id', v_row.reddit_signal_id,
      'title', v_row.title,
      'status', v_row.status,
      'request_id', v_row.request_id,
      'output', v_row.output,
      'previous_output', v_row.previous_output,
      'publishable', v_row.publishable,
      'blocking_reason', v_row.blocking_reason,
      'error', v_row.error,
      'heartbeat_at', v_row.heartbeat_at,
      'started_at', v_row.started_at,
      'finished_at', v_row.finished_at,
      'created_at', v_row.created_at,
      'updated_at', v_row.updated_at,
      'source', v_source
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_get_research_topic(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_get_research_topic(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.n8n_upsert_research_topic_brief(
  p_request_id text,
  p_status text,
  p_error text DEFAULT NULL,
  p_output jsonb DEFAULT NULL,
  p_publishable boolean DEFAULT NULL,
  p_blocking_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.research_topics%ROWTYPE;
  v_request_id text;
  v_next_status text;
BEGIN
  v_request_id := btrim(p_request_id);
  IF v_request_id IS NULL OR v_request_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_status');
  END IF;
  IF p_status IS NULL OR btrim(p_status) = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_status');
  END IF;

  p_status := btrim(p_status);
  IF p_status NOT IN ('queued', 'running', 'done', 'failed') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_status');
  END IF;

  SELECT * INTO v_row
  FROM public.research_topics
  WHERE request_id = v_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unknown_request');
  END IF;

  IF v_row.status = 'done' AND p_status <> 'done' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'topic_id', v_row.id,
      'status', v_row.status
    );
  END IF;

  v_next_status := v_row.status;
  IF NOT public.research_topics_is_backwards_status(v_row.status, p_status) THEN
    v_next_status := p_status;
  ELSIF v_row.status IN ('queued', 'running') AND p_status IN ('queued', 'running') THEN
    v_next_status := v_row.status;
  END IF;

  IF p_status = 'done' THEN
    IF p_output IS NULL OR jsonb_typeof(p_output) <> 'object' OR p_publishable IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_status');
    END IF;

    UPDATE public.research_topics
    SET
      status = 'done',
      output = p_output,
      publishable = p_publishable,
      blocking_reason = NULLIF(btrim(p_blocking_reason), ''),
      error = NULL,
      heartbeat_at = now(),
      finished_at = now(),
      updated_at = now()
    WHERE request_id = v_request_id
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
      'ok', true,
      'topic_id', v_row.id,
      'status', v_row.status
    );
  END IF;

  IF p_error IS NOT NULL THEN
    p_error := public.research_topics_normalize_error(p_error);
  END IF;

  UPDATE public.research_topics
  SET
    status = v_next_status,
    error = CASE
      WHEN v_next_status = 'failed' THEN COALESCE(p_error, error)
      ELSE error
    END,
    heartbeat_at = now(),
    started_at = CASE
      WHEN v_next_status = 'running' AND started_at IS NULL THEN now()
      ELSE started_at
    END,
    finished_at = CASE
      WHEN v_next_status = 'failed' THEN now()
      ELSE finished_at
    END,
    updated_at = now()
  WHERE request_id = v_request_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'topic_id', v_row.id,
    'status', v_row.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_upsert_research_topic_brief(text, text, text, jsonb, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_upsert_research_topic_brief(text, text, text, jsonb, boolean, text)
  TO service_role;

COMMIT;
