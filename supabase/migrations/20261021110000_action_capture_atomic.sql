-- Atomisk validering for aksjonsfangst-RPC-er (ingen delvise commits ved kildefeil).
-- Erstatter funksjonskroppene fra 20261021100000; endrer ikke 20261021100000-filen.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.upsert_action_capture(
  p_cluster jsonb,
  p_sources jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action_key text;
  v_action_type text;
  v_action_name text;
  v_description_nb text;
  v_incoming_status text;
  v_cluster_id uuid;
  v_existing public.action_clusters%ROWTYPE;
  v_is_new boolean := false;
  v_locked boolean;
  v_result_status text;
  v_inserted int := 0;
  v_updated int := 0;
  v_src jsonb;
  v_item_key text;
  v_source_type text;
  v_excerpt text;
  v_publishers text[];
  v_incoming_publishers text[];
  v_incoming_confidence numeric(3, 2);
  v_is_insert boolean;
  v_src_idx int := 0;
BEGIN
  IF p_cluster IS NULL OR jsonb_typeof(p_cluster) <> 'object' THEN
    RAISE EXCEPTION 'action_capture invalid_cluster: p_cluster må være et JSON-objekt'
      USING ERRCODE = '22023';
  END IF;

  v_action_key := btrim(p_cluster ->> 'action_key');
  IF v_action_key IS NULL OR v_action_key = '' THEN
    RAISE EXCEPTION 'action_capture missing_action_key: action_key er påkrevd'
      USING ERRCODE = '22023';
  END IF;

  IF p_sources IS NULL THEN
    p_sources := '[]'::jsonb;
  ELSIF jsonb_typeof(p_sources) <> 'array' THEN
    RAISE EXCEPTION 'action_capture invalid_sources: p_sources må være en JSON-array'
      USING ERRCODE = '22023';
  END IF;

  v_action_type := nullif(btrim(p_cluster ->> 'action_type'), '');
  v_action_name := nullif(btrim(p_cluster ->> 'action_name'), '');
  v_description_nb := nullif(btrim(p_cluster ->> 'description_nb'), '');
  v_incoming_status := nullif(btrim(p_cluster ->> 'status'), '');
  v_incoming_confidence := NULLIF(p_cluster ->> 'max_confidence', '')::numeric(3, 2);

  IF v_incoming_status IS NOT NULL
    AND v_incoming_status NOT IN (
      'candidate',
      'below_threshold',
      'manual_only',
      'blocked',
      'would_draft',
      'drafted',
      'rejected',
      'not_action'
    ) THEN
    RAISE EXCEPTION 'action_capture invalid_cluster_status: ugyldig status %', v_incoming_status
      USING ERRCODE = '22023';
  END IF;

  IF p_cluster ? 'independent_publishers'
    AND jsonb_typeof(p_cluster -> 'independent_publishers') <> 'array' THEN
    RAISE EXCEPTION 'action_capture invalid_independent_publishers: må være JSON-array'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.action_clusters
  WHERE action_key = v_action_key;

  v_is_new := NOT FOUND;

  IF v_is_new THEN
    IF v_action_type IS NULL
      OR v_action_type NOT IN ('boykott', 'opprop', 'demonstrasjon', 'innsamling', 'kampanje') THEN
      RAISE EXCEPTION 'action_capture invalid_action_type: action_type er påkrevd ved ny klynge'
        USING ERRCODE = '22023';
    END IF;
    IF v_action_name IS NULL THEN
      RAISE EXCEPTION 'action_capture missing_action_name: action_name er påkrevd ved ny klynge'
        USING ERRCODE = '22023';
    END IF;
    IF v_description_nb IS NULL THEN
      RAISE EXCEPTION 'action_capture missing_description_nb: description_nb er påkrevd ved ny klynge'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    IF v_action_type IS NOT NULL
      AND v_action_type NOT IN ('boykott', 'opprop', 'demonstrasjon', 'innsamling', 'kampanje') THEN
      RAISE EXCEPTION 'action_capture invalid_action_type: ugyldig action_type %', v_action_type
        USING ERRCODE = '22023';
    END IF;
  END IF;

  FOR v_src IN SELECT value FROM jsonb_array_elements(p_sources) AS t(value) LOOP
    v_item_key := btrim(v_src ->> 'item_key');
    v_source_type := nullif(btrim(v_src ->> 'source_type'), '');

    IF v_item_key IS NULL OR v_item_key = '' THEN
      RAISE EXCEPTION 'action_capture missing_item_key: kilde index % mangler item_key', v_src_idx
        USING ERRCODE = '22023';
    END IF;

    IF v_source_type IS NULL THEN
      RAISE EXCEPTION 'action_capture missing_source_type: kilde index % (item_key=%) mangler source_type', v_src_idx, v_item_key
        USING ERRCODE = '22023';
    END IF;

    IF v_source_type NOT IN ('news_rss', 'reddit', 'petition', 'searxng') THEN
      RAISE EXCEPTION 'action_capture invalid_source_type: kilde index % ugyldig source_type %', v_src_idx, v_source_type
        USING ERRCODE = '22023';
    END IF;

    IF nullif(btrim(v_src ->> 'url_canonical'), '') IS NULL THEN
      RAISE EXCEPTION 'action_capture missing_url_canonical: kilde index % (item_key=%) mangler url_canonical', v_src_idx, v_item_key
        USING ERRCODE = '22023';
    END IF;

    v_src_idx := v_src_idx + 1;
  END LOOP;

  -- Skriv fase (alle kilder validert)
  IF v_is_new THEN
    v_incoming_publishers := COALESCE(
      (
        SELECT array_agg(btrim(value))
        FROM jsonb_array_elements_text(COALESCE(p_cluster -> 'independent_publishers', '[]'::jsonb)) AS t(value)
        WHERE btrim(value) <> ''
      ),
      '{}'::text[]
    );

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
      last_seen_at
    )
    VALUES (
      v_action_key,
      v_action_type,
      v_action_name,
      nullif(btrim(p_cluster ->> 'topic'), ''),
      nullif(btrim(p_cluster ->> 'target'), ''),
      nullif(btrim(p_cluster ->> 'target_kind'), ''),
      v_description_nb,
      nullif(btrim(p_cluster ->> 'sensitive_category'), ''),
      COALESCE(v_incoming_status, 'candidate'),
      COALESCE(p_cluster -> 'verdict_reasons', '[]'::jsonb),
      v_incoming_publishers,
      COALESCE((p_cluster ->> 'national_coverage')::boolean, false),
      v_incoming_confidence,
      p_cluster -> 'best_scale',
      nullif(btrim(p_cluster ->> 'related_issue_id'), ''),
      NULLIF(p_cluster ->> 'related_similarity', '')::numeric(4, 3),
      COALESCE(p_cluster -> 'metadata', '{}'::jsonb),
      COALESCE(
        NULLIF(p_cluster ->> 'last_seen_at', '')::timestamptz,
        now()
      )
    )
    RETURNING id, status INTO v_cluster_id, v_result_status;
  ELSE
    v_cluster_id := v_existing.id;
    v_locked := v_existing.decided_by IS NOT NULL
      OR v_existing.status IN ('drafted', 'rejected');
    v_result_status := v_existing.status;

    v_incoming_publishers := COALESCE(
      (
        SELECT array_agg(btrim(value))
        FROM jsonb_array_elements_text(COALESCE(p_cluster -> 'independent_publishers', '[]'::jsonb)) AS t(value)
        WHERE btrim(value) <> ''
      ),
      '{}'::text[]
    );

    v_publishers := (
      SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::text[])
      FROM unnest(v_existing.independent_publishers || v_incoming_publishers) AS x
      WHERE x IS NOT NULL AND btrim(x) <> ''
    );

    UPDATE public.action_clusters
    SET
      action_type = COALESCE(v_action_type, action_type),
      action_name = COALESCE(v_action_name, action_name),
      topic = COALESCE(nullif(btrim(p_cluster ->> 'topic'), ''), topic),
      target = COALESCE(nullif(btrim(p_cluster ->> 'target'), ''), target),
      target_kind = COALESCE(nullif(btrim(p_cluster ->> 'target_kind'), ''), target_kind),
      description_nb = COALESCE(v_description_nb, description_nb),
      sensitive_category = COALESCE(
        nullif(btrim(p_cluster ->> 'sensitive_category'), ''),
        sensitive_category
      ),
      status = CASE
        WHEN v_locked THEN status
        WHEN v_incoming_status IS NOT NULL THEN v_incoming_status
        ELSE status
      END,
      verdict_reasons = CASE
        WHEN v_locked THEN verdict_reasons
        WHEN p_cluster ? 'verdict_reasons' THEN COALESCE(p_cluster -> 'verdict_reasons', '[]'::jsonb)
        ELSE verdict_reasons
      END,
      independent_publishers = v_publishers,
      national_coverage = CASE
        WHEN p_cluster ? 'national_coverage' THEN COALESCE((p_cluster ->> 'national_coverage')::boolean, national_coverage)
        ELSE national_coverage
      END,
      max_confidence = (
        SELECT max(v)
        FROM unnest(ARRAY[max_confidence, v_incoming_confidence]) AS t(v)
        WHERE v IS NOT NULL
      ),
      best_scale = COALESCE(p_cluster -> 'best_scale', best_scale),
      related_issue_id = COALESCE(nullif(btrim(p_cluster ->> 'related_issue_id'), ''), related_issue_id),
      related_similarity = COALESCE(
        NULLIF(p_cluster ->> 'related_similarity', '')::numeric(4, 3),
        related_similarity
      ),
      metadata = CASE
        WHEN p_cluster ? 'metadata' THEN COALESCE(metadata, '{}'::jsonb) || COALESCE(p_cluster -> 'metadata', '{}'::jsonb)
        ELSE metadata
      END,
      last_seen_at = GREATEST(
        last_seen_at,
        COALESCE(NULLIF(p_cluster ->> 'last_seen_at', '')::timestamptz, now())
      )
    WHERE id = v_cluster_id
    RETURNING status INTO v_result_status;
  END IF;

  FOR v_src IN SELECT value FROM jsonb_array_elements(p_sources) AS t(value) LOOP
    v_item_key := btrim(v_src ->> 'item_key');
    v_excerpt := left(btrim(COALESCE(v_src ->> 'excerpt', '')), 300);

    WITH upserted AS (
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
        btrim(v_src ->> 'url_canonical'),
        nullif(btrim(v_src ->> 'source_type'), ''),
        nullif(btrim(v_src ->> 'publisher'), ''),
        COALESCE((v_src ->> 'signal_only')::boolean, false),
        nullif(btrim(v_src ->> 'title'), ''),
        NULLIF(v_excerpt, ''),
        NULLIF(v_src ->> 'published_at', '')::timestamptz,
        COALESCE(NULLIF(v_src ->> 'fetched_at', '')::timestamptz, now()),
        nullif(btrim(v_src ->> 'status'), ''),
        NULLIF(v_src ->> 'confidence', '')::numeric(3, 2),
        v_src -> 'classification'
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
      RETURNING (xmax = 0) AS inserted
    )
    SELECT inserted INTO v_is_insert FROM upserted;

    IF v_is_insert THEN
      v_inserted := v_inserted + 1;
    ELSE
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'cluster_id', v_cluster_id,
    'inserted_sources', v_inserted,
    'updated_sources', v_updated,
    'status', v_result_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_action_cluster_verdict(
  p_action_key text,
  p_status text,
  p_verdict_reasons jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.action_clusters%ROWTYPE;
  v_locked boolean;
  v_cluster_id uuid;
  v_result_status text;
BEGIN
  p_action_key := btrim(p_action_key);
  IF p_action_key IS NULL OR p_action_key = '' THEN
    RAISE EXCEPTION 'action_capture missing_action_key: p_action_key er påkrevd'
      USING ERRCODE = '22023';
  END IF;

  p_status := btrim(p_status);
  IF p_status IS NULL
    OR p_status NOT IN (
      'candidate',
      'below_threshold',
      'manual_only',
      'blocked',
      'would_draft',
      'drafted',
      'rejected',
      'not_action'
    ) THEN
    RAISE EXCEPTION 'action_capture invalid_cluster_status: p_status må være en gyldig klyngestatus'
      USING ERRCODE = '22023';
  END IF;

  IF p_verdict_reasons IS NULL THEN
    p_verdict_reasons := '[]'::jsonb;
  ELSIF jsonb_typeof(p_verdict_reasons) NOT IN ('array', 'object') THEN
    RAISE EXCEPTION 'action_capture invalid_verdict_reasons: må være JSON-array eller objekt'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.action_clusters
  WHERE action_key = p_action_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'action_capture cluster_not_found: ingen klynge med action_key=%', p_action_key
      USING ERRCODE = '22023';
  END IF;

  v_locked := v_existing.decided_by IS NOT NULL
    OR v_existing.status IN ('drafted', 'rejected');

  IF v_locked THEN
    RAISE EXCEPTION 'action_capture status_locked: status kan ikke endres (cluster_id=%, status=%)', v_existing.id, v_existing.status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.action_clusters
  SET
    status = p_status,
    verdict_reasons = p_verdict_reasons,
    last_seen_at = GREATEST(last_seen_at, now())
  WHERE id = v_existing.id
  RETURNING id, status INTO v_cluster_id, v_result_status;

  RETURN jsonb_build_object(
    'ok', true,
    'cluster_id', v_cluster_id,
    'status', v_result_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_action_capture(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_action_cluster_verdict(text, text, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_action_capture(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_action_cluster_verdict(text, text, jsonb) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
