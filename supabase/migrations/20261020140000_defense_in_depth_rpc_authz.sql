-- Defense-in-depth: caller guards inside user-bound SECURITY DEFINER RPCs (not only EXECUTE revokes).

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
  IF coalesce(auth.role(), '') IS DISTINCT FROM 'service_role'
     AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_rpc_caller_is_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_rpc_caller_is_user(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.assert_rpc_caller_is_actor(p_actor_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_rpc_caller_is_actor(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_rpc_caller_is_actor(uuid) TO service_role;

DROP FUNCTION IF EXISTS public.create_hearing_comment(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.create_app_suggestion(uuid, text);

CREATE OR REPLACE FUNCTION public.get_public_user_displays(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.first_name, u.last_name, u.name
  FROM public.users u
  WHERE p_user_ids IS NOT NULL
    AND u.id = ANY (p_user_ids)
    AND public.user_has_public_display_eligibility(u.id);
$$;

COMMENT ON FUNCTION public.get_public_user_displays(uuid[]) IS
  'Public display names only (first_name, last_name, name). No email, subscription, or avatar. Eligibility via user_has_public_display_eligibility.';

CREATE OR REPLACE FUNCTION public.get_poll_totals_by_fylke(
  p_poll_id uuid,
  p_min_votes int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  row record;
  v_min int := greatest(coalesce(p_min_votes, 10), 10);
BEGIN
  FOR row IN
    SELECT
      c.code,
      c.name,
      c.sort_order,
      count(*) FILTER (WHERE v.choice = 'ja') AS ja_count,
      count(*) FILTER (WHERE v.choice = 'nei') AS nei_count,
      count(*) FILTER (WHERE v.choice = 'blank') AS blank_count,
      count(v.id) AS total_count
    FROM public.norway_counties c
    LEFT JOIN public.poll_votes v
      ON v.fylke_code = c.code AND v.poll_id = p_poll_id
    GROUP BY c.code, c.name, c.sort_order
    ORDER BY c.sort_order
  LOOP
    IF row.total_count >= v_min THEN
      result := result || jsonb_build_array(
        jsonb_build_object(
          'code', row.code,
          'name', row.name,
          'ja', row.ja_count,
          'nei', row.nei_count,
          'blank', row.blank_count,
          'total', row.total_count,
          'sufficientData', true
        )
      );
    ELSE
      result := result || jsonb_build_array(
        jsonb_build_object(
          'code', row.code,
          'name', row.name,
          'ja', null,
          'nei', null,
          'blank', null,
          'total', row.total_count,
          'sufficientData', false
        )
      );
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_poll_totals(uuid) IS
  'Aggregate ja/nei/blank counts only; no per-user or small-cell breakdown.';
COMMENT ON FUNCTION public.get_issue_vote_totals(text) IS
  'Aggregate for/against/abstain counts only; no per-user breakdown.';

CREATE OR REPLACE FUNCTION public.user_has_political_consent(p_user_id uuid, p_purpose text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  RETURN EXISTS (
    SELECT 1
    FROM public.user_political_consents c
    WHERE c.user_id = p_user_id
      AND c.purpose = p_purpose
      AND c.withdrawn_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_stance_on_issue(
  p_user_id uuid,
  p_issue_id text
)
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
      SELECT jsonb_build_object('hasStance', true, 'stance', s.stance, 'updated_at', s.updated_at)
      FROM public.issue_stances s
      WHERE s.user_id = p_user_id
        AND s.stortinget_issue_id = p_issue_id
    ),
    jsonb_build_object('hasStance', false, 'stance', null)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_stance_history(p_user_id uuid)
RETURNS TABLE (
  stortinget_issue_id text,
  title text,
  stance text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  RETURN QUERY
  SELECT
    s.stortinget_issue_id,
    i.title,
    s.stance,
    s.updated_at
  FROM public.issue_stances s
  LEFT JOIN public.stortinget_issues i ON i.id = s.stortinget_issue_id
  WHERE s.user_id = p_user_id
  ORDER BY s.updated_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_stance_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  RETURN (
    SELECT count(*)::integer
    FROM public.issue_stances
    WHERE user_id = p_user_id
      AND stance IN ('enig', 'uenig')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_stance_signals(p_user_id uuid, p_limit integer DEFAULT 6)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  RETURN (
    WITH engaged AS (
      SELECT
        i.category,
        unnest(coalesce(i.ai_labels, array[]::text[])) AS label
      FROM public.issue_stances s
      JOIN public.stortinget_issues i ON i.id = s.stortinget_issue_id
      WHERE s.user_id = p_user_id
        AND s.stance IN ('enig', 'uenig')
    ),
    category_counts AS (
      SELECT category AS value, count(*)::integer AS count
      FROM engaged
      WHERE category IS NOT NULL AND btrim(category) <> ''
      GROUP BY category
      ORDER BY count DESC, category ASC
      LIMIT p_limit
    ),
    label_counts AS (
      SELECT label AS value, count(*)::integer AS count
      FROM engaged
      WHERE label IS NOT NULL AND btrim(label) <> ''
      GROUP BY label
      ORDER BY count DESC, label ASC
      LIMIT p_limit
    )
    SELECT jsonb_build_object(
      'categories', coalesce((SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count)) FROM category_counts), '[]'::jsonb),
      'labels', coalesce((SELECT jsonb_agg(jsonb_build_object('value', value, 'count', count)) FROM label_counts), '[]'::jsonb)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cast_prompt_vote(
  p_user_id uuid,
  p_prompt_id uuid,
  p_option_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_prompt public.forum_prompts%ROWTYPE;
  v_option_exists boolean;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  PERFORM public.ensure_public_user(p_user_id);

  SELECT * INTO v_prompt FROM public.forum_prompts
  WHERE id = p_prompt_id AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prompt not found or inactive';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_prompt.options) opt
    WHERE opt->>'id' = p_option_id
  ) INTO v_option_exists;

  IF NOT v_option_exists THEN
    RAISE EXCEPTION 'Invalid option';
  END IF;

  INSERT INTO public.forum_prompt_votes (user_id, prompt_id, option_id)
  VALUES (p_user_id, p_prompt_id, p_option_id)
  ON CONFLICT (user_id, prompt_id) DO UPDATE SET option_id = EXCLUDED.option_id;

  RETURN public.get_prompt_results(p_prompt_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.suggest_trusted_news_source(
  p_user_id uuid,
  p_domain text,
  p_outlet_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_points integer := 0;
  v_domain text;
  v_outlet_label text;
  v_monthly_used integer;
  v_source_id uuid;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  PERFORM public.ensure_public_user(p_user_id);

  SELECT coalesce(upb.points, 0)
  INTO v_points
  FROM public.user_points_balances upb
  WHERE upb.user_id = p_user_id;

  IF v_points < 5000 THEN
    RAISE EXCEPTION 'insufficient points for source suggestion';
  END IF;

  v_domain := lower(regexp_replace(btrim(coalesce(p_domain, '')), '^www\.', ''));
  v_outlet_label := btrim(coalesce(p_outlet_label, ''));

  IF v_domain = '' OR v_domain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN
    RAISE EXCEPTION 'invalid domain';
  END IF;

  IF char_length(v_outlet_label) < 2 OR char_length(v_outlet_label) > 80 THEN
    RAISE EXCEPTION 'invalid outlet label';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.forum_trusted_sources fts
    WHERE fts.domain = v_domain
  ) THEN
    RAISE EXCEPTION 'domain already exists';
  END IF;

  SELECT count(*)::integer
  INTO v_monthly_used
  FROM public.forum_trusted_sources fts
  WHERE fts.suggested_by = p_user_id
    AND fts.created_at > now() - interval '30 days';

  IF v_monthly_used >= 3 THEN
    RAISE EXCEPTION 'monthly source suggestion limit reached';
  END IF;

  INSERT INTO public.forum_trusted_sources (
    domain,
    outlet_label,
    status,
    suggested_by
  )
  VALUES (
    v_domain,
    v_outlet_label,
    'pending',
    p_user_id
  )
  RETURNING id INTO v_source_id;

  RETURN jsonb_build_object(
    'id', v_source_id,
    'domain', v_domain,
    'outlet_label', v_outlet_label,
    'status', 'pending',
    'monthly_used', v_monthly_used + 1,
    'monthly_limit', 3
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.promote_citizen_initiative_to_poll(
  p_initiative_id uuid,
  p_actor_user_id uuid DEFAULT NULL,
  p_force boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_init public.citizen_initiatives%ROWTYPE;
  v_poll_id uuid;
  v_summary text;
BEGIN
  PERFORM public.assert_rpc_caller_is_actor(p_actor_user_id);

  SELECT * INTO v_init FROM public.citizen_initiatives WHERE id = p_initiative_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Initiative not found';
  END IF;

  IF v_init.status = 'promoted' AND v_init.promoted_poll_id IS NOT NULL THEN
    RETURN v_init.promoted_poll_id;
  END IF;

  IF NOT p_force AND v_init.status NOT IN ('threshold_met', 'gathering') THEN
    RAISE EXCEPTION 'Initiative cannot be promoted from status %', v_init.status;
  END IF;

  IF NOT p_force AND v_init.support_count < v_init.support_threshold THEN
    RAISE EXCEPTION 'Support threshold not met';
  END IF;

  v_summary := left(btrim(v_init.body), 2000);

  INSERT INTO public.polls (
    track,
    status,
    title,
    neutral_summary,
    citizen_initiative_id,
    opens_at,
    created_by
  )
  VALUES (
    'citizen',
    'open',
    v_init.title,
    v_summary,
    v_init.id,
    now(),
    p_actor_user_id
  )
  RETURNING id INTO v_poll_id;

  UPDATE public.citizen_initiatives
  SET
    status = 'promoted',
    promoted_poll_id = v_poll_id,
    updated_at = now()
  WHERE id = p_initiative_id;

  RETURN v_poll_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cast_prompt_vote(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_prompt_vote(uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.suggest_trusted_news_source(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_trusted_news_source(uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.promote_citizen_initiative_to_poll(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_citizen_initiative_to_poll(uuid, uuid, boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
