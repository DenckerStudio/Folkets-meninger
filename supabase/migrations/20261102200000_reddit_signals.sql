-- Reddit interest signals for admin Research (manual apply on supabase-folkets).

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.reddit_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reddit_id text NOT NULL,
  subreddit text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  score int NOT NULL DEFAULT 0,
  num_comments int NOT NULL DEFAULT 0,
  contention numeric GENERATED ALWAYS AS (
    round(num_comments::numeric / greatest(score, 1), 2)
  ) STORED,
  posted_at timestamptz NOT NULL,
  snapshot_at timestamptz NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  topic text,
  related_issue_id text REFERENCES public.stortinget_issues (id) ON DELETE SET NULL,
  related_similarity numeric(4, 3),
  CONSTRAINT reddit_signals_reddit_id_key UNIQUE (reddit_id),
  CONSTRAINT reddit_signals_reddit_id_format CHECK (reddit_id ~ '^[a-z0-9]{1,12}$'),
  CONSTRAINT reddit_signals_subreddit_check CHECK (subreddit IN ('norge', 'norske', 'Nordmenn')),
  CONSTRAINT reddit_signals_title_len CHECK (char_length(title) <= 300),
  CONSTRAINT reddit_signals_url_https CHECK (url ~ '^https://www\.reddit\.com/comments/[a-z0-9]{1,12}/$')
);

CREATE INDEX IF NOT EXISTS reddit_signals_subreddit_last_seen_idx
  ON public.reddit_signals (subreddit, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS reddit_signals_related_issue_id_idx
  ON public.reddit_signals (related_issue_id)
  WHERE related_issue_id IS NOT NULL;

ALTER TABLE public.reddit_signals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.reddit_signals FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.reddit_signals TO service_role;

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
  v_url text;
  v_exists boolean;
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
        related_similarity
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
        v_related_similarity
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
        related_similarity = COALESCE(EXCLUDED.related_similarity, rs.related_similarity);

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
    'rejected', v_rejected
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.n8n_upsert_reddit_signals(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_upsert_reddit_signals(jsonb) TO service_role;

COMMIT;
