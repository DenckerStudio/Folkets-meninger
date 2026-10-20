-- F1: content_feedback, kilder, n8n-RPC-er og auto-logging for system-Reels.
-- Krever manuell apply på supabase-folkets (Mathias' ja).

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.content_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (
    content_type IN ('reel', 'ai_summary', 'blog_post', 'poll', 'action', 'source_item')
  ),
  content_id text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('approve', 'reject', 'neutral')),
  aspects jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason_tags text[] NOT NULL DEFAULT '{}',
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(768),
  source text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'historic', 'auto')),
  admin_id uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz
);

CREATE INDEX IF NOT EXISTS content_feedback_type_created_idx
  ON public.content_feedback (content_type, created_at DESC);

CREATE INDEX IF NOT EXISTS content_feedback_type_content_idx
  ON public.content_feedback (content_type, content_id);

CREATE UNIQUE INDEX IF NOT EXISTS content_feedback_current_uidx
  ON public.content_feedback (content_type, content_id)
  WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS content_feedback_embedding_hnsw_idx
  ON public.content_feedback USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS public.content_sources (
  domain text PRIMARY KEY,
  tier text NOT NULL DEFAULT 'normal' CHECK (tier IN ('primary', 'normal', 'signal_only', 'blocked')),
  base_weight numeric(4, 2) NOT NULL DEFAULT 1.0,
  learned_weight numeric(4, 2),
  ingest jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.source_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL REFERENCES public.content_sources (domain),
  external_id text NOT NULL,
  url text NOT NULL,
  title text NOT NULL,
  excerpt varchar(400),
  categories text[] NOT NULL DEFAULT '{}',
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  embedding vector(768),
  UNIQUE (domain, external_id)
);

CREATE INDEX IF NOT EXISTS source_items_published_at_idx
  ON public.source_items (published_at DESC);

CREATE INDEX IF NOT EXISTS source_items_embedding_hnsw_idx
  ON public.source_items USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS public.feedback_profile (
  content_type text PRIMARY KEY CHECK (
    content_type IN ('reel', 'ai_summary', 'blog_post', 'poll', 'action', 'source_item')
  ),
  profile jsonb NOT NULL,
  calibration jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS og grants (mønster action_capture)
-- ---------------------------------------------------------------------------

ALTER TABLE public.content_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_profile ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.content_feedback FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.content_sources FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.source_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.feedback_profile FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.content_feedback TO service_role;
GRANT ALL ON TABLE public.content_sources TO service_role;
GRANT ALL ON TABLE public.source_items TO service_role;
GRANT ALL ON TABLE public.feedback_profile TO service_role;

GRANT SELECT ON TABLE public.content_feedback TO authenticated;
GRANT SELECT ON TABLE public.content_sources TO authenticated;
GRANT SELECT ON TABLE public.source_items TO authenticated;
GRANT SELECT ON TABLE public.feedback_profile TO authenticated;

DROP POLICY IF EXISTS content_feedback_admin_read ON public.content_feedback;
CREATE POLICY content_feedback_admin_read ON public.content_feedback
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS content_sources_admin_read ON public.content_sources;
CREATE POLICY content_sources_admin_read ON public.content_sources
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS source_items_admin_read ON public.source_items;
CREATE POLICY source_items_admin_read ON public.source_items
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS feedback_profile_admin_read ON public.feedback_profile;
CREATE POLICY feedback_profile_admin_read ON public.feedback_profile
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- Poll snapshot + auto-feedback (etter forum-mønsteret)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.build_poll_reel_feedback_snapshot(p_poll public.polls)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_strip_nulls(
    jsonb_build_object(
      'title', p_poll.title,
      'neutral_summary', p_poll.neutral_summary,
      'issue_id', p_poll.stortinget_issue_id,
      'status', p_poll.status,
      'generation_metadata', p_poll.generation_metadata
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.log_poll_content_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_verdict text;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.track <> 'system' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'open' AND OLD.status = 'draft' THEN
    v_verdict := 'approve';
  ELSIF NEW.status = 'archived' AND OLD.status IN ('draft', 'open') THEN
    v_verdict := 'reject';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.content_feedback (
    content_type,
    content_id,
    verdict,
    source,
    snapshot
  )
  VALUES (
    'reel',
    NEW.id::text,
    v_verdict,
    'auto',
    public.build_poll_reel_feedback_snapshot(NEW)
  )
  ON CONFLICT (content_type, content_id) WHERE superseded_at IS NULL
  DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS polls_content_feedback_trg ON public.polls;
CREATE TRIGGER polls_content_feedback_trg
  AFTER UPDATE OF status ON public.polls
  FOR EACH ROW
  EXECUTE FUNCTION public.log_poll_content_feedback();

-- ---------------------------------------------------------------------------
-- Admin upsert (fm-web /api/admin/content-feedback via service_role)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_content_feedback(
  p_content_type text,
  p_content_id text,
  p_verdict text,
  p_aspects jsonb DEFAULT '{}'::jsonb,
  p_reason_tags text[] DEFAULT '{}',
  p_note text DEFAULT NULL,
  p_admin_id uuid DEFAULT NULL,
  p_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_content_type text;
  v_content_id text;
  v_verdict text;
  v_existing_id uuid;
  v_existing_source text;
  v_new_id uuid;
BEGIN
  v_content_type := btrim(coalesce(p_content_type, ''));
  v_content_id := btrim(coalesce(p_content_id, ''));
  v_verdict := btrim(coalesce(p_verdict, ''));

  IF v_content_type IS NULL
    OR v_content_type NOT IN ('reel', 'ai_summary', 'blog_post', 'poll', 'action', 'source_item') THEN
    RAISE EXCEPTION 'Ugyldig content_type: %', p_content_type;
  END IF;

  IF v_content_id IS NULL OR v_content_id = '' THEN
    RAISE EXCEPTION 'content_id er påkrevd';
  END IF;

  IF v_verdict IS NULL OR v_verdict NOT IN ('approve', 'reject', 'neutral') THEN
    RAISE EXCEPTION 'Ugyldig verdict: %', p_verdict;
  END IF;

  IF p_aspects IS NULL OR jsonb_typeof(p_aspects) <> 'object' THEN
    RAISE EXCEPTION 'aspects må være et JSON-objekt';
  END IF;

  IF p_reason_tags IS NULL THEN
    p_reason_tags := '{}';
  END IF;

  IF p_note IS NOT NULL AND char_length(p_note) > 1000 THEN
    RAISE EXCEPTION 'note kan ikke være lengre enn 1000 tegn';
  END IF;

  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'snapshot må være et JSON-objekt';
  END IF;

  SELECT cf.id, cf.source
  INTO v_existing_id, v_existing_source
  FROM public.content_feedback cf
  WHERE cf.content_type = v_content_type
    AND cf.content_id = v_content_id
    AND cf.superseded_at IS NULL
  FOR UPDATE;

  IF v_existing_id IS NOT NULL AND v_existing_source = 'auto' THEN
    UPDATE public.content_feedback
    SET
      verdict = v_verdict,
      aspects = coalesce(p_aspects, '{}'::jsonb),
      reason_tags = coalesce(p_reason_tags, '{}'::text[]),
      note = p_note,
      admin_id = p_admin_id,
      source = 'admin',
      snapshot = CASE
        WHEN p_snapshot = '{}'::jsonb THEN snapshot
        ELSE snapshot || p_snapshot
      END
    WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.content_feedback
    SET superseded_at = now()
    WHERE id = v_existing_id;
  END IF;

  INSERT INTO public.content_feedback (
    content_type,
    content_id,
    verdict,
    aspects,
    reason_tags,
    note,
    snapshot,
    source,
    admin_id
  )
  VALUES (
    v_content_type,
    v_content_id,
    v_verdict,
    coalesce(p_aspects, '{}'::jsonb),
    coalesce(p_reason_tags, '{}'::text[]),
    p_note,
    coalesce(p_snapshot, '{}'::jsonb),
    'admin',
    p_admin_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- n8n RPC-er
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.n8n_feedback_examples(
  p_type text,
  p_query_embedding vector(768),
  p_k int DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text;
  v_k int;
  v_recent jsonb;
  v_similar jsonb;
BEGIN
  v_type := btrim(coalesce(p_type, ''));
  IF v_type IS NULL
    OR v_type NOT IN ('reel', 'ai_summary', 'blog_post', 'poll', 'action', 'source_item') THEN
    RAISE EXCEPTION 'Ugyldig content_type: %', p_type;
  END IF;

  IF p_query_embedding IS NULL THEN
    RAISE EXCEPTION 'p_query_embedding er påkrevd';
  END IF;

  v_k := greatest(1, least(coalesce(p_k, 3), 20));

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT
      cf.id,
      cf.verdict,
      cf.aspects,
      cf.reason_tags,
      cf.note,
      cf.snapshot,
      cf.created_at
    FROM public.content_feedback cf
    WHERE cf.content_type = v_type
      AND cf.superseded_at IS NULL
      AND cf.verdict IN ('approve', 'reject')
    ORDER BY cf.created_at DESC
    LIMIT v_k * 2
  ) t;

  SELECT coalesce(
    jsonb_build_object(
      'approve',
      (
        SELECT coalesce(jsonb_agg(row_to_json(s)::jsonb ORDER BY s.similarity DESC), '[]'::jsonb)
        FROM (
          SELECT
            cf.id,
            cf.verdict,
            cf.aspects,
            cf.reason_tags,
            cf.note,
            cf.snapshot,
            1 - (cf.embedding <=> p_query_embedding) AS similarity
          FROM public.content_feedback cf
          WHERE cf.content_type = v_type
            AND cf.superseded_at IS NULL
            AND cf.verdict = 'approve'
            AND cf.embedding IS NOT NULL
          ORDER BY cf.embedding <=> p_query_embedding
          LIMIT v_k
        ) s
      ),
      'reject',
      (
        SELECT coalesce(jsonb_agg(row_to_json(s)::jsonb ORDER BY s.similarity DESC), '[]'::jsonb)
        FROM (
          SELECT
            cf.id,
            cf.verdict,
            cf.aspects,
            cf.reason_tags,
            cf.note,
            cf.snapshot,
            1 - (cf.embedding <=> p_query_embedding) AS similarity
          FROM public.content_feedback cf
          WHERE cf.content_type = v_type
            AND cf.superseded_at IS NULL
            AND cf.verdict = 'reject'
            AND cf.embedding IS NOT NULL
          ORDER BY cf.embedding <=> p_query_embedding
          LIMIT v_k
        ) s
      )
    ),
    jsonb_build_object('approve', '[]'::jsonb, 'reject', '[]'::jsonb)
  )
  INTO v_similar;

  RETURN jsonb_build_object(
    'content_type', v_type,
    'recent', v_recent,
    'similar', v_similar
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_feedback_similarity(
  p_type text,
  p_embedding vector(768)
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text;
  v_max_approved numeric;
  v_max_rejected numeric;
  v_n_rejected_similar int;
  v_threshold numeric := 0.90;
BEGIN
  v_type := btrim(coalesce(p_type, ''));
  IF v_type IS NULL
    OR v_type NOT IN ('reel', 'ai_summary', 'blog_post', 'poll', 'action', 'source_item') THEN
    RAISE EXCEPTION 'Ugyldig content_type: %', p_type;
  END IF;

  IF p_embedding IS NULL THEN
    RAISE EXCEPTION 'p_embedding er påkrevd';
  END IF;

  SELECT
    coalesce(max(1 - (cf.embedding <=> p_embedding)) FILTER (WHERE cf.verdict = 'approve'), 0),
    coalesce(max(1 - (cf.embedding <=> p_embedding)) FILTER (WHERE cf.verdict = 'reject'), 0),
    count(*) FILTER (
      WHERE cf.verdict = 'reject'
        AND (1 - (cf.embedding <=> p_embedding)) >= v_threshold
    )::int
  INTO v_max_approved, v_max_rejected, v_n_rejected_similar
  FROM public.content_feedback cf
  WHERE cf.content_type = v_type
    AND cf.superseded_at IS NULL
    AND cf.embedding IS NOT NULL;

  RETURN jsonb_build_object(
    'content_type', v_type,
    'max_sim_approved', v_max_approved,
    'max_sim_rejected', v_max_rejected,
    'n_rejected_similar', coalesce(v_n_rejected_similar, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_upsert_source_items(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_domain text;
  v_external_id text;
  v_inserted int := 0;
  v_updated int := 0;
  v_is_insert boolean;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items må være en JSON-array';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS t(value) LOOP
    v_domain := btrim(v_item ->> 'domain');
    v_external_id := btrim(v_item ->> 'external_id');

    IF v_domain IS NULL OR v_domain = '' THEN
      RAISE EXCEPTION 'Hvert element må ha domain';
    END IF;

    IF v_external_id IS NULL OR v_external_id = '' THEN
      RAISE EXCEPTION 'Hvert element må ha external_id';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.content_sources cs WHERE cs.domain = v_domain) THEN
      RAISE EXCEPTION 'Ukjent domene i content_sources: %', v_domain;
    END IF;

    IF nullif(btrim(v_item ->> 'url'), '') IS NULL THEN
      RAISE EXCEPTION 'url er påkrevd for %/%', v_domain, v_external_id;
    END IF;

    IF nullif(btrim(v_item ->> 'title'), '') IS NULL THEN
      RAISE EXCEPTION 'title er påkrevd for %/%', v_domain, v_external_id;
    END IF;

    WITH upserted AS (
      INSERT INTO public.source_items (
        domain,
        external_id,
        url,
        title,
        excerpt,
        categories,
        published_at,
        fetched_at,
        embedding
      )
      VALUES (
        v_domain,
        v_external_id,
        btrim(v_item ->> 'url'),
        btrim(v_item ->> 'title'),
        left(btrim(coalesce(v_item ->> 'excerpt', '')), 400),
        coalesce(
          (
            SELECT array_agg(btrim(value))
            FROM jsonb_array_elements_text(coalesce(v_item -> 'categories', '[]'::jsonb)) AS t(value)
            WHERE btrim(value) <> ''
          ),
          '{}'::text[]
        ),
        NULLIF(v_item ->> 'published_at', '')::timestamptz,
        coalesce(NULLIF(v_item ->> 'fetched_at', '')::timestamptz, now()),
        CASE
          WHEN v_item ? 'embedding' AND v_item ->> 'embedding' IS NOT NULL
            THEN (v_item ->> 'embedding')::vector(768)
          ELSE NULL
        END
      )
      ON CONFLICT (domain, external_id) DO UPDATE SET
        url = EXCLUDED.url,
        title = EXCLUDED.title,
        excerpt = EXCLUDED.excerpt,
        categories = EXCLUDED.categories,
        published_at = EXCLUDED.published_at,
        fetched_at = EXCLUDED.fetched_at,
        embedding = coalesce(EXCLUDED.embedding, public.source_items.embedding)
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
    'inserted', v_inserted,
    'updated', v_updated
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_match_source_items(
  p_embedding vector(768),
  p_days int DEFAULT 14,
  p_k int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  domain text,
  external_id text,
  url text,
  title text,
  excerpt varchar(400),
  categories text[],
  published_at timestamptz,
  tier text,
  base_weight numeric(4, 2),
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    si.id,
    si.domain,
    si.external_id,
    si.url,
    si.title,
    si.excerpt,
    si.categories,
    si.published_at,
    cs.tier,
    cs.base_weight,
    1 - (si.embedding <=> p_embedding) AS similarity
  FROM public.source_items si
  JOIN public.content_sources cs ON cs.domain = si.domain
  WHERE si.embedding IS NOT NULL
    AND cs.tier <> 'blocked'
    AND si.published_at >= now() - make_interval(days => greatest(coalesce(p_days, 14), 1))
  ORDER BY si.embedding <=> p_embedding
  LIMIT greatest(coalesce(p_k, 5), 1);
$$;

CREATE OR REPLACE FUNCTION public.n8n_upsert_feedback_profile(
  p_type text,
  p_profile jsonb,
  p_calibration jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text;
BEGIN
  v_type := btrim(coalesce(p_type, ''));
  IF v_type IS NULL
    OR v_type NOT IN ('reel', 'ai_summary', 'blog_post', 'poll', 'action', 'source_item') THEN
    RAISE EXCEPTION 'Ugyldig content_type: %', p_type;
  END IF;

  IF p_profile IS NULL OR jsonb_typeof(p_profile) <> 'object' THEN
    RAISE EXCEPTION 'p_profile må være et JSON-objekt';
  END IF;

  IF p_calibration IS NULL OR jsonb_typeof(p_calibration) <> 'object' THEN
    RAISE EXCEPTION 'p_calibration må være et JSON-objekt';
  END IF;

  INSERT INTO public.feedback_profile (content_type, profile, calibration, updated_at)
  VALUES (v_type, p_profile, p_calibration, now())
  ON CONFLICT (content_type) DO UPDATE SET
    profile = EXCLUDED.profile,
    calibration = EXCLUDED.calibration,
    updated_at = now();

  RETURN jsonb_build_object('ok', true, 'content_type', v_type);
END;
$$;

CREATE OR REPLACE FUNCTION public.n8n_set_feedback_embedding(
  p_id uuid,
  p_embedding vector(768)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated int;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'p_id er påkrevd';
  END IF;

  IF p_embedding IS NULL THEN
    RAISE EXCEPTION 'p_embedding er påkrevd';
  END IF;

  UPDATE public.content_feedback
  SET embedding = p_embedding
  WHERE id = p_id
    AND superseded_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Fant ikke aktiv content_feedback-rad for id %', p_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_content_feedback(
  text, text, text, jsonb, text[], text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_content_feedback(
  text, text, text, jsonb, text[], text, uuid, jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.n8n_feedback_examples(text, vector, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_feedback_examples(text, vector, int) TO service_role;

REVOKE ALL ON FUNCTION public.n8n_feedback_similarity(text, vector) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_feedback_similarity(text, vector) TO service_role;

REVOKE ALL ON FUNCTION public.n8n_upsert_source_items(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_upsert_source_items(jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.n8n_match_source_items(vector, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_match_source_items(vector, int, int) TO service_role;

REVOKE ALL ON FUNCTION public.n8n_upsert_feedback_profile(text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_upsert_feedback_profile(text, jsonb, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.n8n_set_feedback_embedding(uuid, vector) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_set_feedback_embedding(uuid, vector) TO service_role;

-- ---------------------------------------------------------------------------
-- Seed: content_sources
-- ---------------------------------------------------------------------------

INSERT INTO public.content_sources (domain, tier, base_weight, ingest)
VALUES
  (
    'utenfilter.no',
    'primary',
    1.50,
    jsonb_build_object(
      'kind',
      'wp_json',
      'url',
      'https://utenfilter.no/wp-json/wp/v2/posts?per_page=20'
    )
  ),
  ('document.no', 'signal_only', 0.50, '{}'::jsonb),
  ('resett.no', 'signal_only', 0.50, '{}'::jsonb),
  ('nrk.no', 'normal', 1.00, '{}'::jsonb),
  ('vg.no', 'normal', 1.00, '{}'::jsonb),
  ('aftenposten.no', 'normal', 1.00, '{}'::jsonb),
  ('dagbladet.no', 'normal', 1.00, '{}'::jsonb),
  ('e24.no', 'normal', 1.00, '{}'::jsonb),
  ('dn.no', 'normal', 1.00, '{}'::jsonb),
  ('tv2.no', 'normal', 1.00, '{}'::jsonb),
  ('abcnyheter.no', 'normal', 1.00, '{}'::jsonb),
  ('nettavisen.no', 'normal', 1.00, '{}'::jsonb)
ON CONFLICT (domain) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Historikk-seed (idempotent: én historic-rad per innhold)
-- Reels: track=system, open/closed -> approve, archived -> reject
-- Aksjoner: drafted -> approve; rejected/not_action/blocked -> reject
-- ---------------------------------------------------------------------------

INSERT INTO public.content_feedback (
  content_type,
  content_id,
  verdict,
  source,
  snapshot,
  created_at
)
SELECT
  'reel',
  p.id::text,
  CASE WHEN p.status IN ('open', 'closed') THEN 'approve' ELSE 'reject' END,
  'historic',
  public.build_poll_reel_feedback_snapshot(p),
  coalesce(p.updated_at, p.created_at, now())
FROM public.polls p
WHERE p.track = 'system'
  AND p.status IN ('open', 'closed', 'archived')
  AND NOT EXISTS (
    SELECT 1
    FROM public.content_feedback cf
    WHERE cf.content_type = 'reel'
      AND cf.content_id = p.id::text
      AND cf.source = 'historic'
  )
ON CONFLICT (content_type, content_id) WHERE superseded_at IS NULL DO NOTHING;

INSERT INTO public.content_feedback (
  content_type,
  content_id,
  verdict,
  source,
  snapshot,
  created_at
)
SELECT
  'action',
  ac.id::text,
  CASE
    WHEN ac.status = 'drafted' THEN 'approve'
    WHEN ac.status IN ('rejected', 'not_action', 'blocked') THEN 'reject'
    ELSE 'neutral'
  END,
  'historic',
  jsonb_strip_nulls(
    jsonb_build_object(
      'action_key', ac.action_key,
      'action_name', ac.action_name,
      'status', ac.status,
      'topic', ac.topic
    )
  ),
  coalesce(ac.last_seen_at, ac.first_seen_at, now())
FROM public.action_clusters ac
WHERE ac.status IN ('drafted', 'rejected', 'not_action', 'blocked')
  AND NOT EXISTS (
    SELECT 1
    FROM public.content_feedback cf
    WHERE cf.content_type = 'action'
      AND cf.content_id = ac.id::text
      AND cf.source = 'historic'
  )
ON CONFLICT (content_type, content_id) WHERE superseded_at IS NULL DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
