BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.assert_rpc_caller_is_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user id';
  END IF;
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_rpc_caller_is_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_rpc_caller_is_user(uuid) TO service_role;

-- DROP overloads before CREATE: Postgres rejects CREATE OR REPLACE when parameter defaults/names change.
DO $$
DECLARE
  f regprocedure;
  v_name text;
  v_names text[] := ARRAY[
    'cast_vote',
    'cast_poll_vote',
    'get_user_poll_vote',
    'set_issue_stance',
    'create_citizen_opinion',
    'create_citizen_opinion_reply',
    'create_hearing_comment',
    'create_app_suggestion',
    'cast_app_suggestion_vote',
    'set_user_onboarding_state',
    'create_opinion_innspill',
    'endorse_opinion_innspill',
    'report_content',
    'record_political_consent',
    'withdraw_political_consent',
    'withdraw_all_political_consents',
    'purge_political_processing_data',
    'update_user_profile_names',
    'get_user_vote_on_issue',
    'get_user_vote_history'
  ];
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    FOR f IN
      SELECT p.oid::regprocedure
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
    LOOP
      EXECUTE format('DROP FUNCTION IF EXISTS %s', f);
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.cast_vote(
  p_user_id uuid,
  p_issue_id text,
  p_choice text,
  p_title text DEFAULT NULL,
  p_summary text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  IF p_choice IS NULL OR p_choice NOT IN ('for', 'against', 'abstain') THEN
    RAISE EXCEPTION 'Invalid vote choice';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stortinget_issues i
    WHERE i.id = p_issue_id
      AND (
        i.status = 'closed'
        OR i.ferdigbehandlet IS TRUE
        OR (i.voting_closes_at IS NOT NULL AND i.voting_closes_at <= now())
      )
  ) THEN
    RAISE EXCEPTION 'Voting closed';
  END IF;

  INSERT INTO public.user_profiles (user_id, identity_verified, verified_at)
  VALUES (p_user_id, true, now())
  ON CONFLICT (user_id) DO UPDATE
  SET identity_verified = true,
      verified_at = coalesce(public.user_profiles.verified_at, now());

  IF EXISTS (
    SELECT 1 FROM public.user_vote_receipts
    WHERE user_id = p_user_id AND stortinget_issue_id = p_issue_id
  ) THEN
    RAISE EXCEPTION 'Already voted';
  END IF;

  INSERT INTO public.stortinget_issues (id, title, summary, last_synced_at)
  VALUES (
    p_issue_id,
    coalesce(p_title, 'Sak ' || p_issue_id),
    p_summary,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = coalesce(excluded.title, public.stortinget_issues.title),
    summary = coalesce(excluded.summary, public.stortinget_issues.summary),
    last_synced_at = now();

  INSERT INTO public.citizen_votes (stortinget_issue_id, choice)
  VALUES (p_issue_id, p_choice);

  INSERT INTO public.user_vote_receipts (user_id, stortinget_issue_id, choice_encrypted)
  VALUES (p_user_id, p_issue_id, public.encrypt_vote_choice(p_user_id, p_choice));

  RETURN public.get_issue_vote_totals(p_issue_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cast_poll_vote(
  p_user_id uuid,
  p_poll_id uuid,
  p_choice text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_poll public.polls%ROWTYPE;
  v_fylke text;
  v_fylke_verified boolean;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  IF p_choice IS NULL OR p_choice NOT IN ('ja', 'nei', 'blank') THEN
    RAISE EXCEPTION 'Invalid vote choice';
  END IF;

  SELECT * INTO v_poll FROM public.polls WHERE id = p_poll_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;

  IF v_poll.status <> 'open' THEN
    RAISE EXCEPTION 'Voting closed';
  END IF;

  IF v_poll.closes_at IS NOT NULL AND v_poll.closes_at <= now() THEN
    RAISE EXCEPTION 'Voting closed';
  END IF;

  IF v_poll.opens_at IS NOT NULL AND v_poll.opens_at > now() THEN
    RAISE EXCEPTION 'Voting not open yet';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.poll_vote_receipts
    WHERE user_id = p_user_id AND poll_id = p_poll_id
  ) THEN
    RAISE EXCEPTION 'Already voted';
  END IF;

  SELECT
    CASE WHEN fylke_verified THEN fylke_code ELSE NULL END,
    coalesce(fylke_verified, false)
  INTO v_fylke, v_fylke_verified
  FROM public.users
  WHERE id = p_user_id;

  INSERT INTO public.poll_votes (poll_id, choice, fylke_code)
  VALUES (p_poll_id, p_choice, v_fylke);

  INSERT INTO public.poll_vote_receipts (user_id, poll_id, choice_encrypted)
  VALUES (p_user_id, p_poll_id, public.encrypt_vote_choice(p_user_id, p_choice));

  RETURN public.get_poll_totals(p_poll_id) || jsonb_build_object(
    'fylkeAttached', v_fylke IS NOT NULL,
    'fylkeVerified', coalesce(v_fylke_verified, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_poll_vote(p_user_id uuid, p_poll_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted bytea;
  v_choice text;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  SELECT choice_encrypted INTO v_encrypted
  FROM public.poll_vote_receipts
  WHERE user_id = p_user_id AND poll_id = p_poll_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('hasVoted', false);
  END IF;

  v_choice := public.decrypt_vote_choice(p_user_id, v_encrypted);

  RETURN jsonb_build_object(
    'hasVoted', true,
    'vote', v_choice
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_issue_stance(
  p_user_id uuid,
  p_issue_id text,
  p_stance text,
  p_title text DEFAULT NULL,
  p_summary text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  IF p_stance NOT IN ('enig', 'uenig', 'ikke_interessert') THEN
    RAISE EXCEPTION 'invalid stance: %', p_stance;
  END IF;

  INSERT INTO public.stortinget_issues (id, title, summary, last_synced_at)
  VALUES (p_issue_id, p_title, p_summary, now())
  ON CONFLICT (id) DO UPDATE SET
    title = COALESCE(EXCLUDED.title, public.stortinget_issues.title),
    summary = COALESCE(EXCLUDED.summary, public.stortinget_issues.summary),
    last_synced_at = now();

  INSERT INTO public.issue_stances (user_id, stortinget_issue_id, stance, updated_at)
  VALUES (p_user_id, p_issue_id, p_stance, now())
  ON CONFLICT (user_id, stortinget_issue_id) DO UPDATE SET
    stance = EXCLUDED.stance,
    updated_at = now();

  RETURN jsonb_build_object(
    'stance', p_stance,
    'updated_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_citizen_opinion(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_stance text,
  p_stortinget_issue_id text DEFAULT NULL,
  p_points jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_id uuid;
  v_title text;
  v_body text;
  v_stance text;
  v_issue_id text;
  v_points jsonb;
  v_point jsonb;
  v_point_stance text;
  v_point_text text;
  v_for_count integer := 0;
  v_imot_count integer := 0;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_public_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before posting';
  END IF;

  v_title := btrim(coalesce(p_title, ''));
  v_body := btrim(coalesce(p_body, ''));
  v_stance := btrim(coalesce(p_stance, ''));
  v_issue_id := nullif(btrim(coalesce(p_stortinget_issue_id, '')), '');
  v_points := coalesce(p_points, '[]'::jsonb);

  IF char_length(v_title) < 5 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 5 and 200 characters';
  END IF;

  IF v_stance NOT IN ('for', 'imot') THEN
    RAISE EXCEPTION 'Invalid stance';
  END IF;

  IF char_length(v_body) < 250 OR char_length(v_body) > 4000 THEN
    RAISE EXCEPTION 'Body must be between 250 and 4000 characters';
  END IF;

  IF jsonb_typeof(v_points) <> 'array' THEN
    RAISE EXCEPTION 'At least 3 for/imot points required';
  END IF;

  IF jsonb_array_length(v_points) < 3 OR jsonb_array_length(v_points) > 8 THEN
    RAISE EXCEPTION 'At least 3 for/imot points required';
  END IF;

  FOR v_point IN SELECT value FROM jsonb_array_elements(v_points)
  LOOP
    IF jsonb_typeof(v_point) <> 'object' THEN
      RAISE EXCEPTION 'Invalid opinion point';
    END IF;

    v_point_stance := btrim(coalesce(v_point->>'stance', ''));
    v_point_text := btrim(regexp_replace(coalesce(v_point->>'text', ''), '\s+', ' ', 'g'));

    IF v_point_stance NOT IN ('for', 'imot') THEN
      RAISE EXCEPTION 'Invalid opinion point stance';
    END IF;

    IF char_length(v_point_text) < 12 OR char_length(v_point_text) > 280 THEN
      RAISE EXCEPTION 'Each opinion point must be between 12 and 280 characters';
    END IF;

    IF v_point_stance = 'for' THEN
      v_for_count := v_for_count + 1;
    ELSE
      v_imot_count := v_imot_count + 1;
    END IF;
  END LOOP;

  IF v_for_count < 1 OR v_imot_count < 1 THEN
    RAISE EXCEPTION 'Include at least one for and one imot point';
  END IF;

  INSERT INTO public.citizen_opinions (
    author_user_id,
    title,
    body,
    stance,
    stortinget_issue_id,
    points
  )
  VALUES (p_user_id, v_title, v_body, v_stance, v_issue_id, v_points)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_citizen_opinion_reply(
  p_user_id uuid,
  p_opinion_id uuid,
  p_stance text,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_id uuid;
  v_body text;
  v_stance text;
  v_author uuid;
  v_removed boolean;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_public_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before posting';
  END IF;

  IF p_opinion_id IS NULL THEN
    RAISE EXCEPTION 'Opinion id required';
  END IF;

  SELECT author_user_id, is_removed
    INTO v_author, v_removed
  FROM public.citizen_opinions
  WHERE id = p_opinion_id;

  IF v_author IS NULL THEN
    RAISE EXCEPTION 'Opinion not found';
  END IF;

  IF v_removed THEN
    RAISE EXCEPTION 'Opinion not found';
  END IF;

  IF v_author = p_user_id THEN
    RAISE EXCEPTION 'You cannot reply to your own opinion';
  END IF;

  v_body := btrim(coalesce(p_body, ''));
  v_stance := btrim(coalesce(p_stance, ''));

  IF v_stance NOT IN ('for', 'blank', 'imot') THEN
    RAISE EXCEPTION 'Invalid stance';
  END IF;

  IF v_stance = 'blank' THEN
    IF char_length(v_body) > 4000 THEN
      RAISE EXCEPTION 'Body must be at most 4000 characters';
    END IF;
  ELSIF char_length(v_body) < 80 OR char_length(v_body) > 4000 THEN
    RAISE EXCEPTION 'Body must be between 80 and 4000 characters';
  END IF;

  INSERT INTO public.citizen_opinion_replies (
    opinion_id,
    author_user_id,
    stance,
    body
  )
  VALUES (p_opinion_id, p_user_id, v_stance, v_body)
  ON CONFLICT (opinion_id, author_user_id) DO UPDATE
    SET stance = EXCLUDED.stance,
        body = EXCLUDED.body,
        is_removed = false,
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_hearing_comment(
  p_user_id uuid,
  p_stortinget_hearing_id text,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_comment_id uuid;
  v_body text;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_public_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before posting';
  END IF;

  v_body := btrim(p_body);
  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  IF p_stortinget_hearing_id IS NULL OR char_length(trim(p_stortinget_hearing_id)) < 1 THEN
    RAISE EXCEPTION 'Hearing id required';
  END IF;

  INSERT INTO public.hearing_comments (stortinget_hearing_id, body, author_user_id)
  VALUES (trim(p_stortinget_hearing_id), v_body, p_user_id)
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_app_suggestion(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_category text,
  p_audience text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_category text := btrim(coalesce(p_category, ''));
  v_audience text := btrim(coalesce(p_audience, ''));
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  PERFORM public.ensure_public_user(p_user_id);

  IF char_length(v_title) < 8 OR char_length(v_title) > 80 THEN
    RAISE EXCEPTION 'Title must be between 8 and 80 characters';
  END IF;

  IF char_length(v_body) < 20 OR char_length(v_body) > 800 THEN
    RAISE EXCEPTION 'Suggestion must be between 20 and 800 characters';
  END IF;

  IF v_category NOT IN ('funksjon', 'innhold', 'feil', 'annet') THEN
    RAISE EXCEPTION 'Invalid suggestion category';
  END IF;

  IF v_audience NOT IN ('alle', 'innloggede', 'admin', 'meg') THEN
    RAISE EXCEPTION 'Invalid suggestion audience';
  END IF;

  INSERT INTO public.app_suggestions (user_id, title, body, category, audience)
  VALUES (p_user_id, v_title, v_body, v_category, v_audience)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cast_app_suggestion_vote(
  p_user_id uuid,
  p_suggestion_id uuid,
  p_vote text
)
RETURNS TABLE (
  up_count bigint,
  down_count bigint,
  my_vote text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_vote text := btrim(coalesce(p_vote, ''));
  v_open boolean;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  IF p_user_id IS NULL OR p_suggestion_id IS NULL THEN
    RAISE EXCEPTION 'Missing user or suggestion id';
  END IF;

  IF v_vote NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'Invalid vote';
  END IF;

  PERFORM public.ensure_public_user(p_user_id);

  SELECT s.voting_open INTO v_open
  FROM public.app_suggestions s
  WHERE s.id = p_suggestion_id;

  IF v_open IS NULL THEN
    RAISE EXCEPTION 'Suggestion not found';
  END IF;

  IF v_open IS NOT TRUE THEN
    RAISE EXCEPTION 'Voting is closed';
  END IF;

  INSERT INTO public.app_suggestion_votes (suggestion_id, user_id, vote)
  VALUES (p_suggestion_id, p_user_id, v_vote)
  ON CONFLICT (suggestion_id, user_id)
  DO UPDATE SET vote = EXCLUDED.vote, updated_at = now();

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.app_suggestion_votes v WHERE v.suggestion_id = p_suggestion_id AND v.vote = 'up'),
    (SELECT count(*) FROM public.app_suggestion_votes v WHERE v.suggestion_id = p_suggestion_id AND v.vote = 'down'),
    v_vote;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_user_onboarding_state(
  p_user_id uuid,
  p_completed boolean DEFAULT NULL,
  p_skipped boolean DEFAULT NULL,
  p_tour_completed boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.ensure_public_user(p_user_id);

  UPDATE public.users
  SET
    onboarding_completed_at = CASE
      WHEN p_completed IS TRUE THEN COALESCE(onboarding_completed_at, now())
      WHEN p_completed IS FALSE THEN NULL
      ELSE onboarding_completed_at
    END,
    onboarding_skipped = CASE
      WHEN p_skipped IS NULL THEN onboarding_skipped
      ELSE p_skipped
    END,
    onboarding_tour_completed_at = CASE
      WHEN p_tour_completed IS TRUE THEN COALESCE(onboarding_tour_completed_at, now())
      WHEN p_tour_completed IS FALSE THEN NULL
      ELSE onboarding_tour_completed_at
    END
  WHERE id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_opinion_innspill(
  p_user_id uuid,
  p_opinion_id uuid,
  p_stortinget_hearing_id text DEFAULT NULL,
  p_hearing_deadline_at timestamptz DEFAULT NULL,
  p_support_threshold integer DEFAULT 10
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_author uuid;
  v_issue_id text;
  v_threshold integer;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_public_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before submitting an innspill';
  END IF;

  SELECT author_user_id, stortinget_issue_id
    INTO v_author, v_issue_id
    FROM public.citizen_opinions
   WHERE id = p_opinion_id
     AND NOT is_removed;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opinion not found';
  END IF;

  IF v_author <> p_user_id THEN
    RAISE EXCEPTION 'Only the author can submit their opinion as an innspill';
  END IF;

  IF v_issue_id IS NULL THEN
    RAISE EXCEPTION 'Opinion must be linked to a sak before it can become an innspill';
  END IF;

  v_threshold := greatest(1, coalesce(p_support_threshold, 10));

  INSERT INTO public.opinion_innspill (
    opinion_id,
    author_user_id,
    stortinget_hearing_id,
    hearing_deadline_at,
    support_threshold
  )
  VALUES (
    p_opinion_id,
    p_user_id,
    nullif(btrim(coalesce(p_stortinget_hearing_id, '')), ''),
    p_hearing_deadline_at,
    v_threshold
  )
  ON CONFLICT (opinion_id) DO NOTHING;

  RETURN p_opinion_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.endorse_opinion_innspill(
  p_user_id uuid,
  p_opinion_id uuid
)
RETURNS TABLE (support_count integer, support_threshold integer, status text, endorsed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_threshold integer;
  v_current integer;
  v_status text;
  v_inserted boolean;
  v_endorsed boolean;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  PERFORM public.ensure_public_user(p_user_id);

  SELECT support_threshold, support_count, status
    INTO v_threshold, v_current, v_status
    FROM public.opinion_innspill
   WHERE opinion_id = p_opinion_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Innspill not found';
  END IF;

  IF v_status = 'withdrawn' THEN
    RAISE EXCEPTION 'Innspill is withdrawn';
  END IF;

  INSERT INTO public.opinion_innspill_endorsements (opinion_id, user_id)
  VALUES (p_opinion_id, p_user_id)
  ON CONFLICT (opinion_id, user_id) DO NOTHING
  RETURNING TRUE INTO v_inserted;

  v_endorsed := COALESCE(v_inserted, FALSE);

  IF v_endorsed THEN
    v_current := v_current + 1;
  ELSE
    DELETE FROM public.opinion_innspill_endorsements
     WHERE opinion_id = p_opinion_id AND user_id = p_user_id;
    v_current := greatest(0, v_current - 1);
  END IF;

  IF v_status = 'gathering' AND v_current >= v_threshold THEN
    v_status := 'threshold_met';
  ELSIF v_status = 'threshold_met' AND v_current < v_threshold THEN
    v_status := 'gathering';
  END IF;

  UPDATE public.opinion_innspill
     SET support_count = v_current,
         status = v_status,
         updated_at = now()
   WHERE opinion_id = p_opinion_id;

  RETURN QUERY SELECT v_current, v_threshold, v_status, v_endorsed;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_content(
  p_reporter_user_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_category text,
  p_details text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_target_type text;
  v_report_id uuid;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_reporter_user_id);
  PERFORM public.ensure_public_user(p_reporter_user_id);

  v_target_type := btrim(coalesce(p_target_type, ''));

  IF v_target_type NOT IN (
    'issue_discussion_post',
    'citizen_opinion',
    'citizen_opinion_reply'
  ) THEN
    RAISE EXCEPTION 'Unsupported target type';
  END IF;

  IF p_target_id IS NULL THEN
    RAISE EXCEPTION 'Target id required';
  END IF;

  IF v_target_type = 'issue_discussion_post' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.issue_discussion_posts p
       WHERE p.id = p_target_id AND NOT p.is_removed
    ) THEN
      RAISE EXCEPTION 'Post not found';
    END IF;
  ELSIF v_target_type = 'citizen_opinion' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.citizen_opinions o
       WHERE o.id = p_target_id AND NOT o.is_removed
    ) THEN
      RAISE EXCEPTION 'Opinion not found';
    END IF;
  ELSIF v_target_type = 'citizen_opinion_reply' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.citizen_opinion_replies r
       WHERE r.id = p_target_id AND NOT r.is_removed
    ) THEN
      RAISE EXCEPTION 'Reply not found';
    END IF;
  END IF;

  INSERT INTO public.content_reports (
    reporter_user_id,
    target_type,
    target_id,
    category,
    details
  )
  VALUES (
    p_reporter_user_id,
    v_target_type,
    p_target_id,
    p_category,
    p_details
  )
  ON CONFLICT (reporter_user_id, target_type, target_id) DO UPDATE
    SET category = EXCLUDED.category,
        details = EXCLUDED.details,
        created_at = now()
  RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_political_consent(
  p_user_id uuid,
  p_purpose text,
  p_consent_text_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  IF p_user_id IS NULL OR p_purpose IS NULL OR p_consent_text_version IS NULL THEN
    RAISE EXCEPTION 'Missing consent parameters';
  END IF;

  INSERT INTO public.user_political_consents (user_id, purpose, consent_text_version, consented_at, withdrawn_at)
  VALUES (p_user_id, p_purpose, p_consent_text_version, now(), NULL)
  ON CONFLICT (user_id, purpose) DO UPDATE SET
    consent_text_version = EXCLUDED.consent_text_version,
    consented_at = EXCLUDED.consented_at,
    withdrawn_at = NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_political_consent(p_user_id uuid, p_purpose text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  UPDATE public.user_political_consents
  SET withdrawn_at = now()
  WHERE user_id = p_user_id
    AND purpose = p_purpose
    AND withdrawn_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_all_political_consents(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  UPDATE public.user_political_consents
  SET withdrawn_at = now()
  WHERE user_id = p_user_id
    AND withdrawn_at IS NULL;

  PERFORM public.purge_political_processing_data(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_political_processing_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  DELETE FROM public.issue_stances WHERE user_id = p_user_id;
  DELETE FROM public.user_vote_receipts WHERE user_id = p_user_id;
  DELETE FROM public.poll_vote_receipts WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_profile_names(
  p_user_id uuid,
  p_first_name text,
  p_last_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_first text;
  v_last text;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  v_first := trim(p_first_name);
  v_last := trim(p_last_name);

  IF char_length(v_first) < 2 OR char_length(v_last) < 2 THEN
    RAISE EXCEPTION 'Fornavn og etternavn må være minst 2 tegn';
  END IF;

  PERFORM public.ensure_public_user(p_user_id);

  UPDATE public.users
  SET
    first_name = v_first,
    last_name = v_last,
    name = trim(v_first || ' ' || v_last)
  WHERE id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_vote_on_issue(p_user_id uuid, p_issue_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_encrypted bytea;
  v_choice text;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  SELECT choice_encrypted INTO v_encrypted
  FROM public.user_vote_receipts
  WHERE user_id = p_user_id AND stortinget_issue_id = p_issue_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('hasVoted', false);
  END IF;

  v_choice := public.decrypt_vote_choice(p_user_id, v_encrypted);

  RETURN jsonb_build_object(
    'hasVoted', true,
    'vote', v_choice
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_vote_history(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'stortinget_issue_id', r.stortinget_issue_id,
          'title', coalesce(i.title, 'Sak ' || r.stortinget_issue_id),
          'voted_at', r.voted_at
        )
        ORDER BY r.voted_at DESC
      )
      FROM public.user_vote_receipts r
      LEFT JOIN public.stortinget_issues i ON i.id = r.stortinget_issue_id
      WHERE r.user_id = p_user_id
    ),
    '[]'::jsonb
  );
END;
$$;

-- Re-apply service_role EXECUTE after DROP (prod hotfix + half-migrated state).
DO $$
DECLARE
  f regprocedure;
  v_name text;
  v_names text[] := ARRAY[
    'cast_vote',
    'cast_poll_vote',
    'get_user_poll_vote',
    'set_issue_stance',
    'create_citizen_opinion',
    'create_citizen_opinion_reply',
    'create_hearing_comment',
    'create_app_suggestion',
    'cast_app_suggestion_vote',
    'set_user_onboarding_state',
    'create_opinion_innspill',
    'endorse_opinion_innspill',
    'report_content',
    'record_political_consent',
    'withdraw_political_consent',
    'withdraw_all_political_consents',
    'purge_political_processing_data',
    'update_user_profile_names',
    'get_user_vote_on_issue',
    'get_user_vote_history',
    'get_user_stance_on_issue',
    'get_user_stance_history',
    'get_user_stance_count',
    'get_user_stance_signals',
    'user_has_political_consent'
  ];
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    FOR f IN
      SELECT p.oid::regprocedure
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
