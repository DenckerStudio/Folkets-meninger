-- User-submitted forum reels gated by points tier.

ALTER TABLE public.forum_prompts
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submission_tier text
    CHECK (submission_tier IS NULL OR submission_tier IN ('trusted', 'curator'));

CREATE INDEX IF NOT EXISTS forum_prompts_submitted_by_created_idx
  ON public.forum_prompts (submitted_by, created_at DESC)
  WHERE submitted_by IS NOT NULL;

CREATE OR REPLACE FUNCTION public.normalize_url_hostname(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_host text;
BEGIN
  IF p_url IS NULL OR btrim(p_url) = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_host := lower(
      split_part(
        regexp_replace(
          regexp_replace(btrim(p_url), '^https?://', '', 'i'),
          '[/?#].*$',
          ''
        ),
        ':',
        1
      )
    );
    v_host := regexp_replace(v_host, '^www\.', '');
    RETURN nullif(v_host, '');
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.url_has_trusted_source(p_url text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.normalize_url_hostname(p_url) IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.forum_trusted_sources ts
      WHERE ts.status = 'approved'
        AND (
          public.normalize_url_hostname(p_url) = ts.domain
          OR public.normalize_url_hostname(p_url) LIKE '%.' || ts.domain
        )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.submit_forum_prompt(
  p_user_id uuid,
  p_question text,
  p_source_headlines jsonb,
  p_topic_tags text[] DEFAULT '{}'::text[],
  p_sensitivity text DEFAULT 'low'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_points integer := 0;
  v_question text;
  v_sensitivity text;
  v_submission_tier text;
  v_status text := 'draft';
  v_weekly_limit integer;
  v_weekly_used integer;
  v_prompt_id uuid;
  v_source jsonb;
  v_title text;
  v_url text;
  v_outlet text;
  v_sources jsonb := '[]'::jsonb;
  v_has_source boolean := false;
  v_all_trusted boolean := true;
  v_sort_order integer;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  SELECT coalesce(upb.points, 0)
  INTO v_points
  FROM public.user_points_balances upb
  WHERE upb.user_id = p_user_id;

  IF v_points < 750 THEN
    RAISE EXCEPTION 'insufficient points for reel submission';
  END IF;

  IF v_points >= 2000 THEN
    v_submission_tier := 'curator';
    v_weekly_limit := 5;
  ELSE
    v_submission_tier := 'trusted';
    v_weekly_limit := 2;
  END IF;

  SELECT count(*)::integer
  INTO v_weekly_used
  FROM public.forum_prompts fp
  WHERE fp.submitted_by = p_user_id
    AND fp.created_at > now() - interval '7 days';

  IF v_weekly_used >= v_weekly_limit THEN
    RAISE EXCEPTION 'weekly reel submission limit reached';
  END IF;

  v_question := btrim(coalesce(p_question, ''));
  IF char_length(v_question) < 12 THEN
    RAISE EXCEPTION 'question too short';
  END IF;
  IF char_length(v_question) > 280 THEN
    RAISE EXCEPTION 'question too long';
  END IF;

  v_sensitivity := CASE WHEN lower(coalesce(p_sensitivity, 'low')) = 'high' THEN 'high' ELSE 'low' END;

  IF p_source_headlines IS NULL OR jsonb_typeof(p_source_headlines) <> 'array' THEN
    RAISE EXCEPTION 'sources required';
  END IF;

  FOR v_source IN SELECT value FROM jsonb_array_elements(p_source_headlines)
  LOOP
    v_title := btrim(coalesce(v_source->>'title', ''));
    v_url := btrim(coalesce(v_source->>'url', v_source->>'link', ''));
    v_outlet := btrim(coalesce(nullif(v_source->>'outlet', ''), 'Nyhet'));

    IF v_title = '' OR v_url = '' THEN
      CONTINUE;
    END IF;

    v_has_source := true;
    IF NOT public.url_has_trusted_source(v_url) THEN
      v_all_trusted := false;
    END IF;

    v_sources := v_sources || jsonb_build_array(
      jsonb_build_object(
        'title', v_title,
        'url', v_url,
        'outlet', v_outlet
      )
    );
  END LOOP;

  IF NOT v_has_source THEN
    RAISE EXCEPTION 'sources required';
  END IF;

  IF v_submission_tier = 'curator' AND v_all_trusted THEN
    v_status := 'active';
  ELSE
    v_status := 'draft';
  END IF;

  SELECT coalesce(max(sort_order), 0) + 1
  INTO v_sort_order
  FROM public.forum_prompts;

  INSERT INTO public.forum_prompts (
    question,
    options,
    source_headlines,
    topic_tags,
    sensitivity,
    status,
    sort_order,
    expires_at,
    submitted_by,
    submission_tier
  )
  VALUES (
    v_question,
    '[
      {"id":"ja","label":"Ja"},
      {"id":"nei","label":"Nei"},
      {"id":"ikke_interessert","label":"Ikke interessert"}
    ]'::jsonb,
    v_sources,
    coalesce(p_topic_tags, '{}'::text[]),
    v_sensitivity,
    v_status,
    v_sort_order,
    CASE
      WHEN v_status = 'active' THEN now() + interval '7 days'
      ELSE NULL
    END,
    p_user_id,
    v_submission_tier
  )
  RETURNING id INTO v_prompt_id;

  IF v_status = 'active' THEN
    PERFORM public.award_user_points(
      p_user_id,
      25,
      'reel_published',
      'forum_prompt',
      'reel-published:' || v_prompt_id::text,
      v_prompt_id
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_prompt_id,
    'status', v_status,
    'submission_tier', v_submission_tier,
    'requires_admin', v_status = 'draft',
    'weekly_used', v_weekly_used + 1,
    'weekly_limit', v_weekly_limit
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.award_points_for_approved_user_reel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.submitted_by IS NOT NULL
    AND NEW.status = 'active'
    AND OLD.status = 'draft' THEN
    PERFORM public.award_user_points(
      NEW.submitted_by,
      25,
      'reel_approved',
      'forum_prompt',
      'reel-approved:' || NEW.id::text,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_points_for_approved_user_reel ON public.forum_prompts;
CREATE TRIGGER trg_award_points_for_approved_user_reel
AFTER UPDATE OF status ON public.forum_prompts
FOR EACH ROW
EXECUTE FUNCTION public.award_points_for_approved_user_reel();

REVOKE ALL ON FUNCTION public.submit_forum_prompt(uuid, text, jsonb, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_url_hostname(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.url_has_trusted_source(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_points_for_approved_user_reel() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_forum_prompt(uuid, text, jsonb, text[], text) TO service_role;
