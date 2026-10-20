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
  v_url_canonical text;
  v_excerpt text;
  v_is_insert boolean;
  v_src_idx int := 0;
  v_signal_only boolean;
  v_incoming_first_seen timestamptz;
  v_incoming_last_seen timestamptz;
  v_publisher text;
  v_title text;
  v_published_at timestamptz;
  v_fetched_at timestamptz;
  v_src_status text;
  v_confidence numeric(3, 2);
  v_classification jsonb;
  v_prev_cluster_id uuid;
  v_moved_from_clusters uuid[] := '{}'::uuid[];
  v_recalc_cluster_id uuid;
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

  IF (p_cluster ? 'independent_publishers')
    AND jsonb_typeof(p_cluster -> 'independent_publishers') <> 'array' THEN
    RAISE EXCEPTION 'action_capture invalid_independent_publishers: må være JSON-array'
      USING ERRCODE = '22023';
  END IF;

  IF (p_cluster ? 'first_seen_at')
    AND jsonb_typeof(p_cluster -> 'first_seen_at') <> 'null'
    AND nullif(btrim(p_cluster ->> 'first_seen_at'), '') IS NOT NULL THEN
    v_incoming_first_seen := (p_cluster ->> 'first_seen_at')::timestamptz;
  END IF;

  IF (p_cluster ? 'last_seen_at')
    AND jsonb_typeof(p_cluster -> 'last_seen_at') <> 'null'
    AND nullif(btrim(p_cluster ->> 'last_seen_at'), '') IS NOT NULL THEN
    v_incoming_last_seen := (p_cluster ->> 'last_seen_at')::timestamptz;
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
    v_source_type := nullif(btrim(v_src ->> 'source_type'), '');
    v_url_canonical := nullif(btrim(v_src ->> 'url_canonical'), '');
    v_item_key := nullif(btrim(v_src ->> 'item_key'), '');

    IF v_source_type IS NULL THEN
      RAISE EXCEPTION 'action_capture missing_source_type: kilde index % mangler source_type', v_src_idx
        USING ERRCODE = '22023';
    END IF;

    IF v_source_type NOT IN ('news_rss', 'reddit', 'petition', 'searxng') THEN
      RAISE EXCEPTION 'action_capture invalid_source_type: kilde index % ugyldig source_type %', v_src_idx, v_source_type
        USING ERRCODE = '22023';
    END IF;

    IF v_url_canonical IS NULL THEN
      RAISE EXCEPTION 'action_capture missing_url_canonical: kilde index % mangler url_canonical', v_src_idx
        USING ERRCODE = '22023';
    END IF;

    IF v_item_key IS NULL THEN
      v_item_key := v_source_type || ':url:' || lower(regexp_replace(v_url_canonical, '/$', ''));
    ELSIF position(v_source_type || ':' in v_item_key) <> 1 THEN
      RAISE EXCEPTION 'action_capture invalid_item_key: kilde index % item_key må starte med %:', v_src_idx, v_source_type
        USING ERRCODE = '22023';
    END IF;

    v_src_idx := v_src_idx + 1;
  END LOOP;

  IF v_is_new THEN
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
      v_action_type,
      v_action_name,
      CASE
        WHEN (p_cluster ? 'topic') AND jsonb_typeof(p_cluster -> 'topic') <> 'null'
        THEN nullif(btrim(p_cluster ->> 'topic'), '')
        ELSE NULL
      END,
      CASE
        WHEN (p_cluster ? 'target') AND jsonb_typeof(p_cluster -> 'target') <> 'null'
        THEN nullif(btrim(p_cluster ->> 'target'), '')
        ELSE NULL
      END,
      CASE
        WHEN (p_cluster ? 'target_kind') AND jsonb_typeof(p_cluster -> 'target_kind') <> 'null'
        THEN nullif(btrim(p_cluster ->> 'target_kind'), '')
        ELSE NULL
      END,
      v_description_nb,
      CASE
        WHEN (p_cluster ? 'sensitive_category') AND jsonb_typeof(p_cluster -> 'sensitive_category') <> 'null'
        THEN nullif(btrim(p_cluster ->> 'sensitive_category'), '')
        ELSE NULL
      END,
      COALESCE(v_incoming_status, 'candidate'),
      CASE
        WHEN (p_cluster ? 'verdict_reasons') AND jsonb_typeof(p_cluster -> 'verdict_reasons') <> 'null'
        THEN p_cluster -> 'verdict_reasons'
        ELSE '[]'::jsonb
      END,
      '{}'::text[],
      CASE
        WHEN (p_cluster ? 'national_coverage') AND jsonb_typeof(p_cluster -> 'national_coverage') <> 'null'
        THEN (p_cluster ->> 'national_coverage')::boolean
        ELSE false
      END,
      NULL,
      CASE
        WHEN (p_cluster ? 'best_scale') AND jsonb_typeof(p_cluster -> 'best_scale') <> 'null'
        THEN p_cluster -> 'best_scale'
        ELSE NULL
      END,
      CASE
        WHEN (p_cluster ? 'related_issue_id') AND jsonb_typeof(p_cluster -> 'related_issue_id') <> 'null'
        THEN nullif(btrim(p_cluster ->> 'related_issue_id'), '')
        ELSE NULL
      END,
      CASE
        WHEN (p_cluster ? 'related_similarity') AND jsonb_typeof(p_cluster -> 'related_similarity') <> 'null'
        THEN (p_cluster ->> 'related_similarity')::numeric(4, 3)
        ELSE NULL
      END,
      CASE
        WHEN (p_cluster ? 'metadata') AND jsonb_typeof(p_cluster -> 'metadata') <> 'null'
        THEN p_cluster -> 'metadata'
        ELSE '{}'::jsonb
      END,
      COALESCE(v_incoming_first_seen, now()),
      COALESCE(v_incoming_last_seen, now())
    )
    ON CONFLICT (action_key) DO NOTHING
    RETURNING id, status INTO v_cluster_id, v_result_status;

    IF v_cluster_id IS NULL THEN
      SELECT * INTO v_existing
      FROM public.action_clusters
      WHERE action_key = v_action_key;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'action_capture cluster_insert_race: kunne ikke opprette eller finne klynge for action_key=%', v_action_key
          USING ERRCODE = '22023';
      END IF;
      v_is_new := false;
    END IF;
  END IF;

  IF NOT v_is_new THEN
    v_cluster_id := v_existing.id;
    v_locked := v_existing.decided_by IS NOT NULL
      OR v_existing.status IN ('drafted', 'rejected');
    v_result_status := v_existing.status;

    UPDATE public.action_clusters
    SET
      action_type = COALESCE(v_action_type, action_type),
      action_name = COALESCE(v_action_name, action_name),
      topic = CASE
        WHEN (p_cluster ? 'topic') AND jsonb_typeof(p_cluster -> 'topic') <> 'null'
        THEN COALESCE(nullif(btrim(p_cluster ->> 'topic'), ''), topic)
        ELSE topic
      END,
      target = CASE
        WHEN (p_cluster ? 'target') AND jsonb_typeof(p_cluster -> 'target') <> 'null'
        THEN COALESCE(nullif(btrim(p_cluster ->> 'target'), ''), target)
        ELSE target
      END,
      target_kind = CASE
        WHEN (p_cluster ? 'target_kind') AND jsonb_typeof(p_cluster -> 'target_kind') <> 'null'
        THEN COALESCE(nullif(btrim(p_cluster ->> 'target_kind'), ''), target_kind)
        ELSE target_kind
      END,
      description_nb = COALESCE(v_description_nb, description_nb),
      sensitive_category = CASE
        WHEN (p_cluster ? 'sensitive_category') AND jsonb_typeof(p_cluster -> 'sensitive_category') <> 'null'
        THEN COALESCE(nullif(btrim(p_cluster ->> 'sensitive_category'), ''), sensitive_category)
        ELSE sensitive_category
      END,
      status = CASE
        WHEN v_locked THEN status
        WHEN v_incoming_status IS NOT NULL THEN v_incoming_status
        ELSE status
      END,
      verdict_reasons = CASE
        WHEN v_locked THEN verdict_reasons
        WHEN (p_cluster ? 'verdict_reasons') AND jsonb_typeof(p_cluster -> 'verdict_reasons') <> 'null'
        THEN p_cluster -> 'verdict_reasons'
        ELSE verdict_reasons
      END,
      national_coverage = CASE
        WHEN (p_cluster ? 'national_coverage') AND jsonb_typeof(p_cluster -> 'national_coverage') <> 'null'
        THEN (p_cluster ->> 'national_coverage')::boolean
        ELSE national_coverage
      END,
      best_scale = CASE
        WHEN (p_cluster ? 'best_scale') AND jsonb_typeof(p_cluster -> 'best_scale') <> 'null'
        THEN p_cluster -> 'best_scale'
        ELSE best_scale
      END,
      related_issue_id = CASE
        WHEN (p_cluster ? 'related_issue_id') AND jsonb_typeof(p_cluster -> 'related_issue_id') <> 'null'
        THEN COALESCE(nullif(btrim(p_cluster ->> 'related_issue_id'), ''), related_issue_id)
        ELSE related_issue_id
      END,
      related_similarity = CASE
        WHEN (p_cluster ? 'related_similarity') AND jsonb_typeof(p_cluster -> 'related_similarity') <> 'null'
        THEN (p_cluster ->> 'related_similarity')::numeric(4, 3)
        ELSE related_similarity
      END,
      metadata = CASE
        WHEN (p_cluster ? 'metadata') AND jsonb_typeof(p_cluster -> 'metadata') <> 'null'
        THEN metadata || COALESCE(p_cluster -> 'metadata', '{}'::jsonb)
        ELSE metadata
      END,
      first_seen_at = CASE
        WHEN v_incoming_first_seen IS NOT NULL THEN LEAST(first_seen_at, v_incoming_first_seen)
        ELSE first_seen_at
      END,
      last_seen_at = GREATEST(
        last_seen_at,
        COALESCE(v_incoming_last_seen, now())
      )
    WHERE id = v_cluster_id
    RETURNING status INTO v_result_status;
  END IF;

  FOR v_src IN SELECT value FROM jsonb_array_elements(p_sources) AS t(value) LOOP
    v_source_type := nullif(btrim(v_src ->> 'source_type'), '');
    v_url_canonical := btrim(v_src ->> 'url_canonical');
    v_item_key := nullif(btrim(v_src ->> 'item_key'), '');
    IF v_item_key IS NULL THEN
      v_item_key := v_source_type || ':url:' || lower(regexp_replace(v_url_canonical, '/$', ''));
    END IF;

    v_signal_only := false;
    IF (v_src ? 'signal_only') THEN
      v_signal_only := COALESCE((v_src ->> 'signal_only')::boolean, false);
    ELSIF nullif(btrim(v_src ->> 'record_kind'), '') = 'signal' THEN
      v_signal_only := true;
    ELSIF (v_src ? 'metadata') AND (v_src -> 'metadata') ? 'is_signal' THEN
      v_signal_only := COALESCE((v_src -> 'metadata' ->> 'is_signal')::boolean, false);
    ELSIF (v_src ? 'is_signal') THEN
      v_signal_only := COALESCE((v_src ->> 'is_signal')::boolean, false);
    END IF;

    v_excerpt := left(btrim(COALESCE(v_src ->> 'excerpt', '')), 300);

    v_publisher := CASE
      WHEN (v_src ? 'publisher') AND jsonb_typeof(v_src -> 'publisher') <> 'null'
      THEN nullif(btrim(v_src ->> 'publisher'), '')
      ELSE NULL
    END;
    v_title := CASE
      WHEN (v_src ? 'title') AND jsonb_typeof(v_src -> 'title') <> 'null'
      THEN nullif(btrim(v_src ->> 'title'), '')
      ELSE NULL
    END;
    v_published_at := CASE
      WHEN (v_src ? 'published_at') AND jsonb_typeof(v_src -> 'published_at') <> 'null'
      THEN nullif(v_src ->> 'published_at', '')::timestamptz
      ELSE NULL
    END;
    v_fetched_at := CASE
      WHEN (v_src ? 'fetched_at') AND jsonb_typeof(v_src -> 'fetched_at') <> 'null'
      THEN nullif(v_src ->> 'fetched_at', '')::timestamptz
      ELSE now()
    END;
    v_src_status := CASE
      WHEN (v_src ? 'status') AND jsonb_typeof(v_src -> 'status') <> 'null'
      THEN nullif(btrim(v_src ->> 'status'), '')
      ELSE NULL
    END;
    v_confidence := CASE
      WHEN (v_src ? 'confidence') AND jsonb_typeof(v_src -> 'confidence') <> 'null'
      THEN nullif(v_src ->> 'confidence', '')::numeric(3, 2)
      ELSE NULL
    END;
    v_classification := CASE
      WHEN (v_src ? 'classification') AND jsonb_typeof(v_src -> 'classification') <> 'null'
      THEN v_src -> 'classification'
      ELSE NULL
    END;

    SELECT s.cluster_id INTO v_prev_cluster_id
    FROM public.action_sources s
    WHERE s.item_key = v_item_key;

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
        v_url_canonical,
        v_source_type,
        v_publisher,
        v_signal_only,
        v_title,
        NULLIF(v_excerpt, ''),
        v_published_at,
        v_fetched_at,
        v_src_status,
        v_confidence,
        v_classification
      )
      ON CONFLICT (item_key) DO UPDATE SET
        cluster_id = EXCLUDED.cluster_id,
        url_canonical = CASE
          WHEN (v_src ? 'url_canonical') AND jsonb_typeof(v_src -> 'url_canonical') <> 'null'
          THEN COALESCE(nullif(btrim(v_src ->> 'url_canonical'), ''), action_sources.url_canonical)
          ELSE action_sources.url_canonical
        END,
        source_type = CASE
          WHEN (v_src ? 'source_type') AND jsonb_typeof(v_src -> 'source_type') <> 'null'
          THEN COALESCE(nullif(btrim(v_src ->> 'source_type'), ''), action_sources.source_type)
          ELSE action_sources.source_type
        END,
        publisher = CASE
          WHEN (v_src ? 'publisher') AND jsonb_typeof(v_src -> 'publisher') <> 'null'
          THEN COALESCE(nullif(btrim(v_src ->> 'publisher'), ''), action_sources.publisher)
          ELSE action_sources.publisher
        END,
        signal_only = CASE
          WHEN (v_src ? 'signal_only')
            OR (v_src ? 'record_kind')
            OR ((v_src ? 'metadata') AND (v_src -> 'metadata') ? 'is_signal')
            OR (v_src ? 'is_signal')
          THEN EXCLUDED.signal_only
          ELSE action_sources.signal_only
        END,
        title = CASE
          WHEN (v_src ? 'title') AND jsonb_typeof(v_src -> 'title') <> 'null'
          THEN COALESCE(nullif(btrim(v_src ->> 'title'), ''), action_sources.title)
          ELSE action_sources.title
        END,
        excerpt = CASE
          WHEN (v_src ? 'excerpt') AND jsonb_typeof(v_src -> 'excerpt') <> 'null'
          THEN COALESCE(NULLIF(left(btrim(v_src ->> 'excerpt'), 300), ''), action_sources.excerpt)
          ELSE action_sources.excerpt
        END,
        published_at = CASE
          WHEN (v_src ? 'published_at') AND jsonb_typeof(v_src -> 'published_at') <> 'null'
          THEN COALESCE(nullif(v_src ->> 'published_at', '')::timestamptz, action_sources.published_at)
          ELSE action_sources.published_at
        END,
        fetched_at = COALESCE(EXCLUDED.fetched_at, action_sources.fetched_at),
        status = CASE
          WHEN (v_src ? 'status') AND jsonb_typeof(v_src -> 'status') <> 'null'
          THEN COALESCE(nullif(btrim(v_src ->> 'status'), ''), action_sources.status)
          ELSE action_sources.status
        END,
        confidence = CASE
          WHEN (v_src ? 'confidence') AND jsonb_typeof(v_src -> 'confidence') <> 'null'
          THEN COALESCE(nullif(v_src ->> 'confidence', '')::numeric(3, 2), action_sources.confidence)
          ELSE action_sources.confidence
        END,
        classification = CASE
          WHEN (v_src ? 'classification') AND jsonb_typeof(v_src -> 'classification') <> 'null'
          THEN COALESCE(EXCLUDED.classification, action_sources.classification)
          ELSE action_sources.classification
        END
      RETURNING (xmax = 0) AS inserted
    )
    SELECT inserted INTO v_is_insert FROM upserted;

    IF v_is_insert THEN
      v_inserted := v_inserted + 1;
    ELSE
      v_updated := v_updated + 1;
    END IF;

    IF v_prev_cluster_id IS NOT NULL
      AND v_prev_cluster_id IS DISTINCT FROM v_cluster_id
      AND NOT (v_prev_cluster_id = ANY (v_moved_from_clusters)) THEN
      v_moved_from_clusters := array_append(v_moved_from_clusters, v_prev_cluster_id);
    END IF;
  END LOOP;

  FOR v_recalc_cluster_id IN
    SELECT DISTINCT unnest(v_moved_from_clusters || ARRAY[v_cluster_id])
  LOOP
    UPDATE public.action_clusters c
    SET
      independent_publishers = COALESCE(
        (
          SELECT array_agg(DISTINCT s.publisher ORDER BY s.publisher)
          FROM public.action_sources s
          WHERE s.cluster_id = c.id
            AND s.signal_only = false
            AND s.publisher IS NOT NULL
            AND btrim(s.publisher) <> ''
        ),
        '{}'::text[]
      ),
      max_confidence = (
        SELECT max(s.confidence)
        FROM public.action_sources s
        WHERE s.cluster_id = c.id
      )
    WHERE c.id = v_recalc_cluster_id;
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
  WHERE action_key = p_action_key
  FOR UPDATE;

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
