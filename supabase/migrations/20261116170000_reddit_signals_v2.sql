-- Reddit Research fase 2: utvidet schema, blokkliste, snapshots, status. Manuell apply på prod.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.reddit_signals
  ADD COLUMN IF NOT EXISTS upvote_ratio numeric,
  ADD COLUMN IF NOT EXISTS num_crossposts int,
  ADD COLUMN IF NOT EXISTS crosspost_parent text,
  ADD COLUMN IF NOT EXISTS link_domain text,
  ADD COLUMN IF NOT EXISTS link_url_canonical text,
  ADD COLUMN IF NOT EXISTS flair text,
  ADD COLUMN IF NOT EXISTS removal_type text,
  ADD COLUMN IF NOT EXISTS matured_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_relevance smallint,
  ADD COLUMN IF NOT EXISTS ai_reason text,
  ADD COLUMN IF NOT EXISTS ai_model text,
  ADD COLUMN IF NOT EXISTS ai_scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ny',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS cluster_id text;

ALTER TABLE public.reddit_signals
  DROP CONSTRAINT IF EXISTS reddit_signals_ai_relevance_check;

ALTER TABLE public.reddit_signals
  ADD CONSTRAINT reddit_signals_ai_relevance_check
    CHECK (ai_relevance IS NULL OR (ai_relevance >= 1 AND ai_relevance <= 5));

ALTER TABLE public.reddit_signals
  DROP CONSTRAINT IF EXISTS reddit_signals_status_check;

ALTER TABLE public.reddit_signals
  ADD CONSTRAINT reddit_signals_status_check
    CHECK (
      status IN ('ny', 'brukt', 'ignorert', 'auto_ignorert', 'blokkert')
    );

CREATE INDEX IF NOT EXISTS reddit_signals_status_idx
  ON public.reddit_signals (status);

CREATE INDEX IF NOT EXISTS reddit_signals_cluster_id_idx
  ON public.reddit_signals (cluster_id)
  WHERE cluster_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reddit_signals_link_url_canonical_idx
  ON public.reddit_signals (link_url_canonical)
  WHERE link_url_canonical IS NOT NULL;

CREATE INDEX IF NOT EXISTS reddit_signals_ai_relevance_idx
  ON public.reddit_signals (ai_relevance DESC NULLS LAST)
  WHERE ai_relevance IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.reddit_signal_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid NOT NULL REFERENCES public.reddit_signals (id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL,
  score int NOT NULL DEFAULT 0,
  num_comments int NOT NULL DEFAULT 0,
  upvote_ratio numeric,
  num_crossposts int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reddit_signal_snapshots_signal_captured_idx
  ON public.reddit_signal_snapshots (signal_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.reddit_blocklist (
  reddit_id text PRIMARY KEY,
  reason text NOT NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reddit_blocklist_reddit_id_format CHECK (reddit_id ~ '^[a-z0-9]{1,12}$')
);

CREATE TABLE IF NOT EXISTS public.reddit_signal_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid NOT NULL REFERENCES public.reddit_signals (id) ON DELETE CASCADE,
  action text NOT NULL,
  reason text,
  actor uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reddit_signal_feedback_signal_created_idx
  ON public.reddit_signal_feedback (signal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.reddit_ingest_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reddit_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reddit_signal_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reddit_blocklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reddit_signal_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reddit_ingest_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.reddit_signals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reddit_signals TO authenticated;
GRANT ALL ON TABLE public.reddit_signals TO service_role;

REVOKE ALL ON TABLE public.reddit_signal_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reddit_signal_snapshots TO authenticated;
GRANT ALL ON TABLE public.reddit_signal_snapshots TO service_role;

REVOKE ALL ON TABLE public.reddit_blocklist FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reddit_blocklist TO authenticated;
GRANT ALL ON TABLE public.reddit_blocklist TO service_role;

REVOKE ALL ON TABLE public.reddit_signal_feedback FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reddit_signal_feedback TO authenticated;
GRANT ALL ON TABLE public.reddit_signal_feedback TO service_role;

REVOKE ALL ON TABLE public.reddit_ingest_config FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reddit_ingest_config TO authenticated;
GRANT ALL ON TABLE public.reddit_ingest_config TO service_role;

DROP POLICY IF EXISTS reddit_signals_admin_select ON public.reddit_signals;
CREATE POLICY reddit_signals_admin_select ON public.reddit_signals
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS reddit_signals_admin_insert ON public.reddit_signals;
CREATE POLICY reddit_signals_admin_insert ON public.reddit_signals
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS reddit_signals_admin_update ON public.reddit_signals;
CREATE POLICY reddit_signals_admin_update ON public.reddit_signals
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS reddit_signals_admin_delete ON public.reddit_signals;
CREATE POLICY reddit_signals_admin_delete ON public.reddit_signals
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS reddit_signal_snapshots_admin_select ON public.reddit_signal_snapshots;
CREATE POLICY reddit_signal_snapshots_admin_select ON public.reddit_signal_snapshots
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS reddit_signal_snapshots_admin_insert ON public.reddit_signal_snapshots;
CREATE POLICY reddit_signal_snapshots_admin_insert ON public.reddit_signal_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS reddit_signal_snapshots_admin_update ON public.reddit_signal_snapshots;
CREATE POLICY reddit_signal_snapshots_admin_update ON public.reddit_signal_snapshots
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS reddit_signal_snapshots_admin_delete ON public.reddit_signal_snapshots;
CREATE POLICY reddit_signal_snapshots_admin_delete ON public.reddit_signal_snapshots
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS reddit_blocklist_admin_select ON public.reddit_blocklist;
CREATE POLICY reddit_blocklist_admin_select ON public.reddit_blocklist
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS reddit_blocklist_admin_insert ON public.reddit_blocklist;
CREATE POLICY reddit_blocklist_admin_insert ON public.reddit_blocklist
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS reddit_blocklist_admin_update ON public.reddit_blocklist;
CREATE POLICY reddit_blocklist_admin_update ON public.reddit_blocklist
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS reddit_blocklist_admin_delete ON public.reddit_blocklist;
CREATE POLICY reddit_blocklist_admin_delete ON public.reddit_blocklist
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS reddit_signal_feedback_admin_select ON public.reddit_signal_feedback;
CREATE POLICY reddit_signal_feedback_admin_select ON public.reddit_signal_feedback
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS reddit_signal_feedback_admin_insert ON public.reddit_signal_feedback;
CREATE POLICY reddit_signal_feedback_admin_insert ON public.reddit_signal_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS reddit_signal_feedback_admin_update ON public.reddit_signal_feedback;
CREATE POLICY reddit_signal_feedback_admin_update ON public.reddit_signal_feedback
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS reddit_signal_feedback_admin_delete ON public.reddit_signal_feedback;
CREATE POLICY reddit_signal_feedback_admin_delete ON public.reddit_signal_feedback
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS reddit_ingest_config_admin_select ON public.reddit_ingest_config;
CREATE POLICY reddit_ingest_config_admin_select ON public.reddit_ingest_config
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS reddit_ingest_config_admin_insert ON public.reddit_ingest_config;
CREATE POLICY reddit_ingest_config_admin_insert ON public.reddit_ingest_config
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS reddit_ingest_config_admin_update ON public.reddit_ingest_config;
CREATE POLICY reddit_ingest_config_admin_update ON public.reddit_ingest_config
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS reddit_ingest_config_admin_delete ON public.reddit_ingest_config;
CREATE POLICY reddit_ingest_config_admin_delete ON public.reddit_ingest_config
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.reddit_signals_mark_brukt(
  p_signal_id uuid,
  p_reason text,
  p_actor uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_signal_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.reddit_signals rs
  SET
    status = 'brukt',
    status_reason = COALESCE(p_reason, rs.status_reason),
    decided_at = COALESCE(rs.decided_at, now()),
    decided_by = COALESCE(rs.decided_by, p_actor)
  WHERE rs.id = p_signal_id
    AND rs.status NOT IN ('brukt', 'blokkert');
END;
$$;

REVOKE ALL ON FUNCTION public.reddit_signals_mark_brukt(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reddit_signals_trg_research_topic_brukt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.reddit_signal_id IS NOT NULL THEN
    PERFORM public.reddit_signals_mark_brukt(
      NEW.reddit_signal_id,
      'research_topic_opprettet',
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reddit_signals_trg_research_topic_brukt()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reddit_signals_mark_brukt_on_research_topic_insert
  ON public.research_topics;
CREATE TRIGGER reddit_signals_mark_brukt_on_research_topic_insert
  AFTER INSERT ON public.research_topics
  FOR EACH ROW
  EXECUTE FUNCTION public.reddit_signals_trg_research_topic_brukt();

CREATE OR REPLACE FUNCTION public.reddit_signals_trg_research_topic_sak_poll_brukt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reason text;
BEGIN
  IF NEW.reddit_signal_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.stortinget_issue_id IS NOT NULL
    AND NEW.stortinget_issue_id IS DISTINCT FROM OLD.stortinget_issue_id THEN
    v_reason := 'stortinget_sak_koblet';
    PERFORM public.reddit_signals_mark_brukt(NEW.reddit_signal_id, v_reason, NEW.created_by);
  END IF;

  IF NEW.stortinget_poll_id IS NOT NULL
    AND NEW.stortinget_poll_id IS DISTINCT FROM OLD.stortinget_poll_id THEN
    v_reason := 'stortinget_poll_koblet';
    PERFORM public.reddit_signals_mark_brukt(NEW.reddit_signal_id, v_reason, NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reddit_signals_trg_research_topic_sak_poll_brukt()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reddit_signals_mark_brukt_on_research_topic_sak_poll
  ON public.research_topics;
CREATE TRIGGER reddit_signals_mark_brukt_on_research_topic_sak_poll
  AFTER UPDATE OF stortinget_issue_id, stortinget_poll_id ON public.research_topics
  FOR EACH ROW
  EXECUTE FUNCTION public.reddit_signals_trg_research_topic_sak_poll_brukt();

INSERT INTO public.reddit_blocklist (reddit_id, reason)
VALUES
  ('1xxcxb7', 'seed: intern blokkliste'),
  ('1xxlaug', 'seed: intern blokkliste'),
  ('1xxm9iq', 'seed: intern blokkliste')
ON CONFLICT (reddit_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.n8n_upsert_reddit_signals(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_inserted int := 0;
  v_updated int := 0;
  v_rejected jsonb := '[]'::jsonb;
  v_blocked jsonb := '[]'::jsonb;
  v_deduped jsonb := '{}'::jsonb;
  v_elem jsonb;
  v_reddit_id text;
  v_subreddit text;
  v_title text;
  v_score int;
  v_num_comments int;
  v_posted_at timestamptz;
  v_snapshot_at timestamptz;
  v_topic text;
  v_related_issue_id text;
  v_related_similarity numeric(4, 3);
  v_upvote_ratio numeric;
  v_num_crossposts int;
  v_crosspost_parent text;
  v_link_domain text;
  v_link_url_canonical text;
  v_flair text;
  v_removal_type text;
  v_matured_at timestamptz;
  v_ai_relevance smallint;
  v_ai_reason text;
  v_ai_model text;
  v_ai_scored_at timestamptz;
  v_cluster_id text;
  v_url text;
  v_exists boolean;
  v_signal_id uuid;
  v_i int;
  v_len int;
  v_reason text;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('error', 'p_rows must be a jsonb array');
  END IF;

  v_len := jsonb_array_length(p_rows);
  IF v_len > 100 THEN
    RETURN jsonb_build_object('error', 'max 100 rows per batch');
  END IF;

  FOR v_i IN 0 .. v_len - 1 LOOP
    v_elem := p_rows -> v_i;
    IF jsonb_typeof(v_elem) <> 'object' THEN
      v_rejected := v_rejected || jsonb_build_array(
        jsonb_build_object('reddit_id', '(mangler)', 'reason', 'element must be a json object')
      );
      CONTINUE;
    END IF;
    v_reddit_id := btrim(v_elem ->> 'reddit_id');
    IF v_reddit_id IS NULL OR v_reddit_id = '' THEN
      v_rejected := v_rejected || jsonb_build_array(
        jsonb_build_object('reddit_id', '(mangler)', 'reason', 'reddit_id is required')
      );
      CONTINUE;
    END IF;
    v_deduped := v_deduped || jsonb_build_object(v_reddit_id, v_elem);
  END LOOP;

  FOR v_reddit_id, v_elem IN SELECT key, value FROM jsonb_each(v_deduped) LOOP
    BEGIN
      IF v_reddit_id !~ '^[a-z0-9]{1,12}$' THEN
        v_rejected := v_rejected || jsonb_build_array(
          jsonb_build_object('reddit_id', v_reddit_id, 'reason', 'invalid reddit_id format')
        );
        CONTINUE;
      END IF;

      IF EXISTS (SELECT 1 FROM public.reddit_blocklist b WHERE b.reddit_id = v_reddit_id) THEN
        v_blocked := v_blocked || jsonb_build_array(
          jsonb_build_object('reddit_id', v_reddit_id, 'reason', 'blocklisted')
        );
        CONTINUE;
      END IF;

      v_subreddit := btrim(v_elem ->> 'subreddit');
      IF v_subreddit IS NULL OR v_subreddit NOT IN ('norge', 'norske', 'Nordmenn') THEN
        v_rejected := v_rejected || jsonb_build_array(
          jsonb_build_object('reddit_id', v_reddit_id, 'reason', 'invalid subreddit')
        );
        CONTINUE;
      END IF;

      v_title := left(btrim(v_elem ->> 'title'), 300);
      IF v_title IS NULL OR v_title = '' THEN
        v_rejected := v_rejected || jsonb_build_array(
          jsonb_build_object('reddit_id', v_reddit_id, 'reason', 'title is required')
        );
        CONTINUE;
      END IF;

      BEGIN
        v_posted_at := (v_elem ->> 'posted_at')::timestamptz;
      EXCEPTION
        WHEN OTHERS THEN
          v_rejected := v_rejected || jsonb_build_array(
            jsonb_build_object('reddit_id', v_reddit_id, 'reason', 'invalid posted_at')
          );
          CONTINUE;
      END;

      BEGIN
        v_snapshot_at := (v_elem ->> 'snapshot_at')::timestamptz;
      EXCEPTION
        WHEN OTHERS THEN
          v_rejected := v_rejected || jsonb_build_array(
            jsonb_build_object('reddit_id', v_reddit_id, 'reason', 'invalid snapshot_at')
          );
          CONTINUE;
      END;

      IF v_elem ? 'score' AND v_elem -> 'score' IS NOT NULL AND jsonb_typeof(v_elem -> 'score') <> 'null' THEN
        BEGIN
          v_score := (v_elem ->> 'score')::int;
          IF v_score < 0 THEN
            RAISE EXCEPTION 'negative score';
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            v_rejected := v_rejected || jsonb_build_array(
              jsonb_build_object('reddit_id', v_reddit_id, 'reason', 'invalid score')
            );
            CONTINUE;
        END;
      ELSE
        v_score := 0;
      END IF;

      IF v_elem ? 'num_comments'
        AND v_elem -> 'num_comments' IS NOT NULL
        AND jsonb_typeof(v_elem -> 'num_comments') <> 'null' THEN
        BEGIN
          v_num_comments := (v_elem ->> 'num_comments')::int;
          IF v_num_comments < 0 THEN
            RAISE EXCEPTION 'negative num_comments';
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            v_rejected := v_rejected || jsonb_build_array(
              jsonb_build_object('reddit_id', v_reddit_id, 'reason', 'invalid num_comments')
            );
            CONTINUE;
        END;
      ELSE
        v_num_comments := 0;
      END IF;

      v_upvote_ratio := NULL;
      IF v_elem ? 'upvote_ratio' AND jsonb_typeof(v_elem -> 'upvote_ratio') <> 'null' THEN
        BEGIN
          v_upvote_ratio := (v_elem ->> 'upvote_ratio')::numeric;
        EXCEPTION
          WHEN OTHERS THEN
            v_rejected := v_rejected || jsonb_build_array(
              jsonb_build_object('reddit_id', v_reddit_id, 'reason', 'invalid upvote_ratio')
            );
            CONTINUE;
        END;
      END IF;

      v_num_crossposts := NULL;
      IF v_elem ? 'num_crossposts' AND jsonb_typeof(v_elem -> 'num_crossposts') <> 'null' THEN
        BEGIN
          v_num_crossposts := (v_elem ->> 'num_crossposts')::int;
          IF v_num_crossposts < 0 THEN
            RAISE EXCEPTION 'negative num_crossposts';
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            v_rejected := v_rejected || jsonb_build_array(
              jsonb_build_object('reddit_id', v_reddit_id, 'reason', 'invalid num_crossposts')
            );
            CONTINUE;
        END;
      END IF;

      IF v_elem ? 'crosspost_parent' AND jsonb_typeof(v_elem -> 'crosspost_parent') <> 'null' THEN
        v_crosspost_parent := nullif(btrim(v_elem ->> 'crosspost_parent'), '');
      ELSE
        v_crosspost_parent := NULL;
      END IF;

      IF v_elem ? 'link_domain' AND jsonb_typeof(v_elem -> 'link_domain') <> 'null' THEN
        v_link_domain := nullif(btrim(v_elem ->> 'link_domain'), '');
      ELSE
        v_link_domain := NULL;
      END IF;

      IF v_elem ? 'link_url_canonical' AND jsonb_typeof(v_elem -> 'link_url_canonical') <> 'null' THEN
        v_link_url_canonical := nullif(btrim(v_elem ->> 'link_url_canonical'), '');
      ELSE
        v_link_url_canonical := NULL;
      END IF;

      IF v_elem ? 'flair' AND jsonb_typeof(v_elem -> 'flair') <> 'null' THEN
        v_flair := nullif(btrim(v_elem ->> 'flair'), '');
      ELSE
        v_flair := NULL;
      END IF;

      IF v_elem ? 'removal_type' AND jsonb_typeof(v_elem -> 'removal_type') <> 'null' THEN
        v_removal_type := nullif(btrim(v_elem ->> 'removal_type'), '');
      ELSE
        v_removal_type := NULL;
      END IF;

      v_matured_at := NULL;
      IF v_elem ? 'matured_at' AND jsonb_typeof(v_elem -> 'matured_at') <> 'null' THEN
        BEGIN
          v_matured_at := (v_elem ->> 'matured_at')::timestamptz;
        EXCEPTION
          WHEN OTHERS THEN
            v_rejected := v_rejected || jsonb_build_array(
              jsonb_build_object('reddit_id', v_reddit_id, 'reason', 'invalid matured_at')
            );
            CONTINUE;
        END;
      END IF;

      v_ai_relevance := NULL;
      IF v_elem ? 'ai_relevance' AND jsonb_typeof(v_elem -> 'ai_relevance') <> 'null' THEN
        BEGIN
          v_ai_relevance := (v_elem ->> 'ai_relevance')::smallint;
          IF v_ai_relevance < 1 OR v_ai_relevance > 5 THEN
            RAISE EXCEPTION 'ai_relevance out of range';
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            v_rejected := v_rejected || jsonb_build_array(
              jsonb_build_object('reddit_id', v_reddit_id, 'reason', 'invalid ai_relevance')
            );
            CONTINUE;
        END;
      END IF;

      IF v_elem ? 'ai_reason' AND jsonb_typeof(v_elem -> 'ai_reason') <> 'null' THEN
        v_ai_reason := nullif(btrim(v_elem ->> 'ai_reason'), '');
      ELSE
        v_ai_reason := NULL;
      END IF;

      IF v_elem ? 'ai_model' AND jsonb_typeof(v_elem -> 'ai_model') <> 'null' THEN
        v_ai_model := nullif(btrim(v_elem ->> 'ai_model'), '');
      ELSE
        v_ai_model := NULL;
      END IF;

      v_ai_scored_at := NULL;
      IF v_elem ? 'ai_scored_at' AND jsonb_typeof(v_elem -> 'ai_scored_at') <> 'null' THEN
        BEGIN
          v_ai_scored_at := (v_elem ->> 'ai_scored_at')::timestamptz;
        EXCEPTION
          WHEN OTHERS THEN
            v_rejected := v_rejected || jsonb_build_array(
              jsonb_build_object('reddit_id', v_reddit_id, 'reason', 'invalid ai_scored_at')
            );
            CONTINUE;
        END;
      END IF;

      IF v_elem ? 'cluster_id' AND jsonb_typeof(v_elem -> 'cluster_id') <> 'null' THEN
        v_cluster_id := nullif(btrim(v_elem ->> 'cluster_id'), '');
      ELSE
        v_cluster_id := NULL;
      END IF;

      IF v_elem ? 'topic' AND jsonb_typeof(v_elem -> 'topic') <> 'null' THEN
        v_topic := nullif(btrim(v_elem ->> 'topic'), '');
      ELSE
        v_topic := NULL;
      END IF;

      IF v_elem ? 'related_issue_id' AND jsonb_typeof(v_elem -> 'related_issue_id') <> 'null' THEN
        v_related_issue_id := nullif(btrim(v_elem ->> 'related_issue_id'), '');
        IF v_related_issue_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.stortinget_issues i WHERE i.id = v_related_issue_id
          ) THEN
          v_related_issue_id := NULL;
        END IF;
      ELSE
        v_related_issue_id := NULL;
      END IF;

      IF v_elem ? 'related_similarity' AND jsonb_typeof(v_elem -> 'related_similarity') <> 'null' THEN
        BEGIN
          v_related_similarity := (v_elem ->> 'related_similarity')::numeric(4, 3);
        EXCEPTION
          WHEN OTHERS THEN
            v_rejected := v_rejected || jsonb_build_array(
              jsonb_build_object('reddit_id', v_reddit_id, 'reason', 'invalid related_similarity')
            );
            CONTINUE;
        END;
      ELSE
        v_related_similarity := NULL;
      END IF;

      v_url := 'https://www.reddit.com/comments/' || v_reddit_id || '/';

      SELECT EXISTS (
        SELECT 1 FROM public.reddit_signals rs WHERE rs.reddit_id = v_reddit_id
      ) INTO v_exists;

      INSERT INTO public.reddit_signals AS rs (
        reddit_id,
        subreddit,
        title,
        url,
        score,
        num_comments,
        posted_at,
        snapshot_at,
        topic,
        related_issue_id,
        related_similarity,
        upvote_ratio,
        num_crossposts,
        crosspost_parent,
        link_domain,
        link_url_canonical,
        flair,
        removal_type,
        matured_at,
        ai_relevance,
        ai_reason,
        ai_model,
        ai_scored_at,
        cluster_id
      )
      VALUES (
        v_reddit_id,
        v_subreddit,
        v_title,
        v_url,
        v_score,
        v_num_comments,
        v_posted_at,
        v_snapshot_at,
        v_topic,
        v_related_issue_id,
        v_related_similarity,
        v_upvote_ratio,
        v_num_crossposts,
        v_crosspost_parent,
        v_link_domain,
        v_link_url_canonical,
        v_flair,
        v_removal_type,
        v_matured_at,
        v_ai_relevance,
        v_ai_reason,
        v_ai_model,
        v_ai_scored_at,
        v_cluster_id
      )
      ON CONFLICT (reddit_id) DO UPDATE SET
        subreddit = EXCLUDED.subreddit,
        title = EXCLUDED.title,
        url = EXCLUDED.url,
        score = EXCLUDED.score,
        num_comments = EXCLUDED.num_comments,
        posted_at = EXCLUDED.posted_at,
        snapshot_at = EXCLUDED.snapshot_at,
        last_seen_at = now(),
        topic = EXCLUDED.topic,
        related_issue_id = COALESCE(EXCLUDED.related_issue_id, rs.related_issue_id),
        related_similarity = COALESCE(EXCLUDED.related_similarity, rs.related_similarity),
        upvote_ratio = EXCLUDED.upvote_ratio,
        num_crossposts = EXCLUDED.num_crossposts,
        crosspost_parent = EXCLUDED.crosspost_parent,
        link_domain = EXCLUDED.link_domain,
        link_url_canonical = EXCLUDED.link_url_canonical,
        flair = EXCLUDED.flair,
        removal_type = EXCLUDED.removal_type,
        matured_at = EXCLUDED.matured_at,
        ai_relevance = EXCLUDED.ai_relevance,
        ai_reason = EXCLUDED.ai_reason,
        ai_model = EXCLUDED.ai_model,
        ai_scored_at = EXCLUDED.ai_scored_at,
        cluster_id = EXCLUDED.cluster_id
      RETURNING rs.id INTO v_signal_id;

      INSERT INTO public.reddit_signal_snapshots (
        signal_id,
        captured_at,
        score,
        num_comments,
        upvote_ratio,
        num_crossposts
      )
      VALUES (
        v_signal_id,
        v_snapshot_at,
        v_score,
        v_num_comments,
        v_upvote_ratio,
        v_num_crossposts
      );

      IF v_exists THEN
        v_updated := v_updated + 1;
      ELSE
        v_inserted := v_inserted + 1;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_reason = MESSAGE_TEXT;
        v_rejected := v_rejected || jsonb_build_array(
          jsonb_build_object('reddit_id', v_reddit_id, 'reason', coalesce(v_reason, 'upsert failed'))
        );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'rejected', v_rejected,
    'blocked', v_blocked
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.n8n_upsert_reddit_signals(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_upsert_reddit_signals(jsonb) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';