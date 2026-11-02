-- Admin: publish Stortinget poll on a sak that may still have an active system reel.
-- Archives the system poll in the same transaction without auto content_feedback.

BEGIN;

CREATE OR REPLACE FUNCTION public.log_poll_content_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_verdict text;
BEGIN
  IF current_setting('app.skip_poll_feedback', true) = 'on' THEN
    RETURN NEW;
  END IF;

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
    DO UPDATE SET
      verdict = EXCLUDED.verdict,
      snapshot = EXCLUDED.snapshot
    WHERE public.content_feedback.source = 'auto';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'log_poll_content_feedback: % (poll_id=%)', SQLERRM, NEW.id;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_publish_stortinget_poll(
  p_issue_id text,
  p_title text,
  p_neutral_summary text DEFAULT '',
  p_source_urls jsonb DEFAULT '[]'::jsonb,
  p_closes_at timestamptz DEFAULT NULL,
  p_clear_closes_at boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_issue_id text;
  v_title text;
  v_poll_id uuid;
  v_poll_status text;
BEGIN
  v_issue_id := nullif(btrim(coalesce(p_issue_id, '')), '');
  IF v_issue_id IS NULL THEN
    RAISE EXCEPTION 'Missing issue id';
  END IF;

  v_title := nullif(btrim(coalesce(p_title, '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Missing title';
  END IF;
  IF char_length(v_title) > 130 THEN
    RAISE EXCEPTION 'Title must be at most 130 characters';
  END IF;

  IF p_closes_at IS NOT NULL AND p_closes_at <= now() THEN
    RAISE EXCEPTION 'closes_at must be in the future';
  END IF;

  INSERT INTO public.stortinget_issues (id, title, summary, last_synced_at)
  VALUES (
    v_issue_id,
    v_title,
    nullif(btrim(coalesce(p_neutral_summary, '')), ''),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    last_synced_at = now();

  PERFORM 1
  FROM public.polls
  WHERE stortinget_issue_id = v_issue_id
  FOR UPDATE;

  PERFORM set_config('app.skip_poll_feedback', 'on', true);

  UPDATE public.polls
  SET
    status = 'archived',
    updated_at = now()
  WHERE stortinget_issue_id = v_issue_id
    AND track = 'system'
    AND status IN ('draft', 'open', 'closed');

  SELECT id, status
  INTO v_poll_id, v_poll_status
  FROM public.polls
  WHERE stortinget_issue_id = v_issue_id
    AND track = 'stortinget'
    AND status IN ('draft', 'open', 'closed')
  LIMIT 1;

  IF v_poll_id IS NOT NULL THEN
    UPDATE public.polls
    SET
      title = v_title,
      neutral_summary = coalesce(nullif(btrim(coalesce(p_neutral_summary, '')), ''), neutral_summary),
      source_urls = coalesce(p_source_urls, source_urls),
      status = CASE WHEN v_poll_status = 'draft' THEN 'open' ELSE status END,
      opens_at = CASE
        WHEN v_poll_status = 'draft' THEN coalesce(opens_at, now())
        ELSE opens_at
      END,
      closes_at = CASE
        WHEN p_clear_closes_at THEN NULL
        WHEN p_closes_at IS NOT NULL THEN p_closes_at
        ELSE closes_at
      END,
      updated_at = now()
    WHERE id = v_poll_id;

    RETURN v_poll_id;
  END IF;

  INSERT INTO public.polls (
    track,
    status,
    title,
    neutral_summary,
    stortinget_issue_id,
    source_urls,
    opens_at,
    closes_at
  )
  VALUES (
    'stortinget',
    'open',
    v_title,
    coalesce(nullif(btrim(coalesce(p_neutral_summary, '')), ''), ''),
    v_issue_id,
    coalesce(p_source_urls, '[]'::jsonb),
    now(),
    CASE
      WHEN p_clear_closes_at THEN NULL
      WHEN p_closes_at IS NOT NULL THEN p_closes_at
      ELSE NULL
    END
  )
  RETURNING id INTO v_poll_id;

  RETURN v_poll_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_publish_stortinget_poll(text, text, text, jsonb, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_stortinget_poll(text, text, text, jsonb, timestamptz, boolean) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
