-- Aksjonsfangst: action_clusters, action_sources, poll_kind=aksjon, n8n RPCs (service_role only).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. action_clusters
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.action_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL UNIQUE,
  action_type text NOT NULL CHECK (
    action_type IN ('boykott', 'opprop', 'demonstrasjon', 'innsamling', 'kampanje')
  ),
  action_name text NOT NULL,
  topic text,
  target text,
  target_kind text,
  description_nb text NOT NULL DEFAULT '',
  sensitive_category text,
  status text NOT NULL DEFAULT 'candidate' CHECK (
    status IN (
      'candidate',
      'below_threshold',
      'manual_only',
      'blocked',
      'would_draft',
      'drafted',
      'rejected',
      'not_action'
    )
  ),
  verdict_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  independent_publishers text[] NOT NULL DEFAULT '{}',
  national_coverage boolean NOT NULL DEFAULT false,
  max_confidence numeric(3, 2),
  best_scale jsonb,
  related_issue_id text REFERENCES public.stortinget_issues (id) ON DELETE SET NULL,
  related_similarity numeric(4, 3),
  poll_id uuid,
  reject_reason text,
  decided_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS action_clusters_status_last_seen_idx
  ON public.action_clusters (status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS action_clusters_poll_id_idx
  ON public.action_clusters (poll_id)
  WHERE poll_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. action_sources
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.action_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.action_clusters (id) ON DELETE CASCADE,
  item_key text NOT NULL UNIQUE,
  url_canonical text NOT NULL,
  source_type text CHECK (source_type IN ('news_rss', 'reddit', 'petition', 'searxng')),
  publisher text,
  signal_only boolean NOT NULL DEFAULT false,
  title text,
  excerpt varchar(300),
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  status text,
  confidence numeric(3, 2),
  classification jsonb
);

CREATE INDEX IF NOT EXISTS action_sources_cluster_idx
  ON public.action_sources (cluster_id, fetched_at DESC);

-- ---------------------------------------------------------------------------
-- 3. polls extensions (aksjon)
-- ---------------------------------------------------------------------------
ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS poll_kind text NOT NULL DEFAULT 'sak';

ALTER TABLE public.polls
  DROP CONSTRAINT IF EXISTS polls_poll_kind_check;

ALTER TABLE public.polls
  ADD CONSTRAINT polls_poll_kind_check
  CHECK (poll_kind IN ('sak', 'aksjon'));

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS action_cluster_id uuid REFERENCES public.action_clusters (id) ON DELETE SET NULL;

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS related_issue_id text REFERENCES public.stortinget_issues (id) ON DELETE SET NULL;

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS scale_value integer;

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS scale_unit text;

ALTER TABLE public.polls
  DROP CONSTRAINT IF EXISTS polls_scale_unit_check;

ALTER TABLE public.polls
  ADD CONSTRAINT polls_scale_unit_check
  CHECK (
    scale_unit IS NULL
    OR scale_unit IN ('medlemmer', 'underskrifter', 'deltakere', 'kroner')
  );

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS scale_source_url text;

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS scale_as_of date;

-- Link cluster.poll_id after polls row exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'action_clusters_poll_id_fkey'
  ) THEN
    ALTER TABLE public.action_clusters
      ADD CONSTRAINT action_clusters_poll_id_fkey
      FOREIGN KEY (poll_id) REFERENCES public.polls (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS polls_action_cluster_uidx
  ON public.polls (action_cluster_id)
  WHERE action_cluster_id IS NOT NULL
    AND status IN ('draft', 'open', 'closed');

CREATE INDEX IF NOT EXISTS polls_kind_status_idx
  ON public.polls (poll_kind, status, created_at DESC);

COMMENT ON COLUMN public.polls.poll_kind IS 'sak = storting/reels; aksjon = automatisk oppdaget aksjon (ikke i Reels).';

-- ---------------------------------------------------------------------------
-- 4. RLS + grants (tables)
-- ---------------------------------------------------------------------------
ALTER TABLE public.action_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS action_clusters_admin_read ON public.action_clusters;
CREATE POLICY action_clusters_admin_read ON public.action_clusters
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS action_sources_admin_read ON public.action_sources;
CREATE POLICY action_sources_admin_read ON public.action_sources
  FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.action_clusters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.action_sources FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.action_clusters TO authenticated;
GRANT SELECT ON public.action_sources TO authenticated;
GRANT ALL ON public.action_clusters TO service_role;
GRANT ALL ON public.action_sources TO service_role;

-- ---------------------------------------------------------------------------
-- 5. n8n_upsert_action_source
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_upsert_action_source(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cluster_id uuid;
  v_item_key text;
  v_id uuid;
BEGIN
  v_item_key := nullif(btrim(p ->> 'item_key'), '');
  IF v_item_key IS NULL THEN
    RAISE EXCEPTION 'item_key required';
  END IF;

  SELECT id INTO v_cluster_id
  FROM public.action_clusters
  WHERE action_key = nullif(btrim(p ->> 'action_key'), '');

  IF v_cluster_id IS NULL THEN
    RAISE EXCEPTION 'Unknown action_key';
  END IF;

  INSERT INTO public.action_sources (
    cluster_id,
    item_key,
    url_canonical,
    source_type,
    publisher,
    signal_only,
    title,
    excerpt,
    published_at,
    fetched_at,
    status,
    confidence,
    classification
  )
  VALUES (
    v_cluster_id,
    v_item_key,
    coalesce(nullif(btrim(p ->> 'url_canonical'), ''), p ->> 'url'),
    nullif(btrim(p ->> 'source_type'), ''),
    nullif(btrim(p ->> 'publisher'), ''),
    coalesce((p ->> 'signal_only')::boolean, false),
    nullif(btrim(p ->> 'title'), ''),
    left(nullif(btrim(p ->> 'excerpt'), ''), 300),
    (p ->> 'published_at')::timestamptz,
    coalesce((p ->> 'fetched_at')::timestamptz, now()),
    nullif(btrim(p ->> 'status'), ''),
    (p ->> 'confidence')::numeric,
    coalesce(p -> 'classification', '{}'::jsonb)
  )
  ON CONFLICT (item_key) DO UPDATE SET
    cluster_id = EXCLUDED.cluster_id,
    url_canonical = EXCLUDED.url_canonical,
    source_type = EXCLUDED.source_type,
    publisher = EXCLUDED.publisher,
    signal_only = EXCLUDED.signal_only,
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    published_at = EXCLUDED.published_at,
    fetched_at = EXCLUDED.fetched_at,
    status = EXCLUDED.status,
    confidence = EXCLUDED.confidence,
    classification = EXCLUDED.classification
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'item_key', v_item_key);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. n8n_upsert_action_cluster
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_upsert_action_cluster(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action_key text;
  v_status text;
  v_existing_status text;
  v_id uuid;
  v_publishers text[];
  v_new_status text;
BEGIN
  v_action_key := nullif(btrim(p ->> 'action_key'), '');
  IF v_action_key IS NULL THEN
    RAISE EXCEPTION 'action_key required';
  END IF;

  SELECT status INTO v_existing_status
  FROM public.action_clusters
  WHERE action_key = v_action_key;

  v_new_status := nullif(btrim(p ->> 'status'), '');
  IF v_existing_status IN ('blocked', 'drafted') THEN
    v_status := v_existing_status;
  ELSE
    v_status := coalesce(v_new_status, coalesce(v_existing_status, 'candidate'));
  END IF;

  v_publishers := CASE
    WHEN p ? 'independent_publishers' AND jsonb_typeof(p -> 'independent_publishers') = 'array' THEN
      ARRAY(SELECT jsonb_array_elements_text(p -> 'independent_publishers'))
    ELSE '{}'::text[]
  END;

  INSERT INTO public.action_clusters (
    action_key,
    action_type,
    action_name,
    topic,
    target,
    target_kind,
    description_nb,
    sensitive_category,
    status,
    verdict_reasons,
    independent_publishers,
    national_coverage,
    max_confidence,
    best_scale,
    related_issue_id,
    related_similarity,
    metadata,
    first_seen_at,
    last_seen_at
  )
  VALUES (
    v_action_key,
    coalesce(nullif(btrim(p ->> 'action_type'), ''), 'kampanje'),
    coalesce(nullif(btrim(p ->> 'action_name'), ''), v_action_key),
    nullif(btrim(p ->> 'topic'), ''),
    nullif(btrim(p ->> 'target'), ''),
    nullif(btrim(p ->> 'target_kind'), ''),
    coalesce(nullif(btrim(p ->> 'description_nb'), ''), ''),
    nullif(btrim(p ->> 'sensitive_category'), ''),
    v_status,
    coalesce(p -> 'verdict_reasons', '[]'::jsonb),
    v_publishers,
    coalesce((p ->> 'national_coverage')::boolean, false),
    (p ->> 'max_confidence')::numeric,
    p -> 'best_scale',
    nullif(btrim(p ->> 'related_issue_id'), ''),
    (p ->> 'related_similarity')::numeric,
    coalesce(p -> 'metadata', '{}'::jsonb),
    coalesce((p ->> 'first_seen_at')::timestamptz, now()),
    coalesce((p ->> 'last_seen_at')::timestamptz, now())
  )
  ON CONFLICT (action_key) DO UPDATE SET
    action_type = EXCLUDED.action_type,
    action_name = EXCLUDED.action_name,
    topic = EXCLUDED.topic,
    target = EXCLUDED.target,
    target_kind = EXCLUDED.target_kind,
    description_nb = CASE
      WHEN btrim(EXCLUDED.description_nb) <> '' THEN EXCLUDED.description_nb
      ELSE action_clusters.description_nb
    END,
    sensitive_category = EXCLUDED.sensitive_category,
    status = v_status,
    verdict_reasons = EXCLUDED.verdict_reasons,
    independent_publishers = EXCLUDED.independent_publishers,
    national_coverage = EXCLUDED.national_coverage,
    max_confidence = GREATEST(
      coalesce(action_clusters.max_confidence, 0),
      coalesce(EXCLUDED.max_confidence, 0)
    ),
    best_scale = CASE
      WHEN EXCLUDED.best_scale IS NOT NULL THEN EXCLUDED.best_scale
      ELSE action_clusters.best_scale
    END,
    related_issue_id = coalesce(EXCLUDED.related_issue_id, action_clusters.related_issue_id),
    related_similarity = coalesce(EXCLUDED.related_similarity, action_clusters.related_similarity),
    metadata = action_clusters.metadata || EXCLUDED.metadata,
    last_seen_at = GREATEST(action_clusters.last_seen_at, EXCLUDED.last_seen_at)
  RETURNING id, status INTO v_id, v_status;

  RETURN jsonb_build_object('id', v_id, 'action_key', v_action_key, 'status', v_status);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. n8n_list_action_clusters_for_draft
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_list_action_clusters_for_draft(p_limit int DEFAULT 3)
RETURNS SETOF public.action_clusters
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT c.*
  FROM public.action_clusters c
  WHERE c.status = 'would_draft'
    AND c.poll_id IS NULL
    AND c.last_seen_at > now() - interval '14 days'
  ORDER BY
    c.national_coverage DESC,
    cardinality(c.independent_publishers) DESC,
    c.max_confidence DESC NULLS LAST,
    c.last_seen_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 3), 20));
$$;

-- ---------------------------------------------------------------------------
-- 8. n8n_match_issues_by_embedding
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_match_issues_by_embedding(
  p_query_embedding vector(768),
  p_limit int DEFAULT 5,
  p_min_similarity float DEFAULT 0.80
)
RETURNS TABLE (
  issue_id text,
  title text,
  similarity float
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT
    dc.issue_id,
    i.title,
    max(1 - (dc.embedding <=> p_query_embedding))::float AS similarity
  FROM public.document_chunks dc
  JOIN public.stortinget_issues i ON i.id = dc.issue_id
  WHERE dc.embedding IS NOT NULL
    AND dc.embedding_status = 'ready'
    AND dc.created_at > now() - interval '12 months'
  GROUP BY dc.issue_id, i.title
  HAVING max(1 - (dc.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY similarity DESC
  LIMIT least(greatest(coalesce(p_limit, 5), 1), 10);
$$;

-- ---------------------------------------------------------------------------
-- 9. n8n_create_action_poll_draft
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_create_action_poll_draft(
  p_action_key text,
  p_title text,
  p_neutral_summary text,
  p_source_urls jsonb,
  p_source_url text,
  p_scale_value int,
  p_scale_unit text,
  p_scale_source_url text,
  p_scale_as_of date,
  p_related_issue_id text DEFAULT NULL,
  p_generation_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cluster public.action_clusters%ROWTYPE;
  v_poll_id uuid;
  v_title text;
  v_summary text;
  v_daily_cap int := 1;
  v_weekly_cap int := 10;
  v_daily_count int;
  v_weekly_count int;
  v_oslo_today date;
  v_oslo_week date;
  v_admin_ok boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(p_action_key, '')));

  v_title := btrim(coalesce(p_title, ''));
  v_summary := btrim(coalesce(p_neutral_summary, ''));

  IF char_length(v_title) < 10 OR char_length(v_title) > 140 THEN
    RAISE EXCEPTION 'Title length must be 10–140 characters';
  END IF;
  IF v_title NOT ILIKE 'Støtter du %' THEN
    RAISE EXCEPTION 'Title must start with «Støtter du »';
  END IF;
  IF char_length(v_summary) > 600 THEN
    RAISE EXCEPTION 'Summary too long';
  END IF;

  SELECT * INTO v_cluster
  FROM public.action_clusters
  WHERE action_key = nullif(btrim(p_action_key), '');

  IF v_cluster.id IS NULL THEN
    RETURN jsonb_build_object('created', false, 'reason', 'cluster_not_found');
  END IF;

  IF v_cluster.status = 'blocked' THEN
    RETURN jsonb_build_object('created', false, 'reason', 'cluster_blocked');
  END IF;

  v_admin_ok := coalesce(p_generation_metadata ->> 'approved_by_admin', '') <> '';

  IF v_cluster.status NOT IN ('would_draft', 'manual_only') THEN
    RETURN jsonb_build_object('created', false, 'reason', 'cluster_not_ready');
  END IF;

  IF v_cluster.status = 'manual_only' AND NOT v_admin_ok THEN
    RETURN jsonb_build_object('created', false, 'reason', 'manual_only_requires_admin');
  END IF;

  SELECT p.id INTO v_poll_id
  FROM public.polls p
  WHERE p.action_cluster_id = v_cluster.id
    AND p.status IN ('draft', 'open', 'closed')
  LIMIT 1;

  IF v_poll_id IS NOT NULL THEN
    RETURN jsonb_build_object('poll_id', v_poll_id, 'created', false, 'reason', 'exists');
  END IF;

  v_oslo_today := (timezone('Europe/Oslo', now()))::date;
  v_oslo_week := date_trunc('week', timezone('Europe/Oslo', now()))::date;

  SELECT count(*)::int INTO v_daily_count
  FROM public.polls
  WHERE poll_kind = 'aksjon'
    AND (timezone('Europe/Oslo', created_at))::date = v_oslo_today;

  IF v_daily_count >= v_daily_cap THEN
    RETURN jsonb_build_object('created', false, 'reason', 'daily_cap_reached');
  END IF;

  SELECT count(*)::int INTO v_weekly_count
  FROM public.polls
  WHERE poll_kind = 'aksjon'
    AND date_trunc('week', timezone('Europe/Oslo', created_at))::date = v_oslo_week;

  IF v_weekly_count >= v_weekly_cap THEN
    RETURN jsonb_build_object('created', false, 'reason', 'weekly_cap_reached');
  END IF;

  IF p_related_issue_id IS NOT NULL AND btrim(p_related_issue_id) <> '' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.stortinget_issues WHERE id = btrim(p_related_issue_id)
    ) THEN
      RETURN jsonb_build_object('created', false, 'reason', 'related_issue_not_found');
    END IF;
  END IF;

  INSERT INTO public.polls (
    track,
    poll_kind,
    status,
    title,
    neutral_summary,
    source_urls,
    stortinget_issue_id,
    action_cluster_id,
    related_issue_id,
    source_url,
    scale_value,
    scale_unit,
    scale_source_url,
    scale_as_of,
    generation_metadata
  )
  VALUES (
    'system',
    'aksjon',
    'draft',
    v_title,
    v_summary,
    coalesce(p_source_urls, '[]'::jsonb),
    NULL,
    v_cluster.id,
    nullif(btrim(coalesce(p_related_issue_id, '')), ''),
    nullif(btrim(coalesce(p_source_url, '')), ''),
    p_scale_value,
    nullif(btrim(coalesce(p_scale_unit, '')), ''),
    nullif(btrim(coalesce(p_scale_source_url, '')), ''),
    p_scale_as_of,
    coalesce(p_generation_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_poll_id;

  UPDATE public.action_clusters
  SET status = 'drafted', poll_id = v_poll_id, last_seen_at = now()
  WHERE id = v_cluster.id;

  RETURN jsonb_build_object('poll_id', v_poll_id, 'created', true, 'reason', 'created');
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. n8n_purge_action_sources
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.n8n_purge_action_sources(p_days int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM public.action_sources s
  WHERE s.fetched_at < now() - make_interval(days => greatest(coalesce(p_days, 90), 1))
    AND NOT EXISTS (
      SELECT 1
      FROM public.action_clusters c
      WHERE c.id = s.cluster_id
        AND c.status = 'drafted'
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('deleted', v_deleted);
END;
$$;

-- ---------------------------------------------------------------------------
-- 11. Lock down n8n functions (service_role only)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  f regprocedure;
  v_names text[] := ARRAY[
    'n8n_upsert_action_source',
    'n8n_upsert_action_cluster',
    'n8n_list_action_clusters_for_draft',
    'n8n_match_issues_by_embedding',
    'n8n_create_action_poll_draft',
    'n8n_purge_action_sources'
  ];
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY v_names
  LOOP
    FOR f IN
      SELECT p.oid::regprocedure
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname = v_name
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
