-- User-created ja/nei polls on Stortinget saker, prefixed with "(Jeg mener) ".

CREATE OR REPLACE FUNCTION public.submit_sak_mening_prompt(
  p_user_id uuid,
  p_stortinget_issue_id text,
  p_question text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_question text;
  v_issue_title text;
  v_weekly_used integer;
  v_weekly_limit integer := 10;
  v_prompt_id uuid;
  v_sort_order integer;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_forum_identity(p_user_id) THEN
    RAISE EXCEPTION 'forum identity required';
  END IF;

  v_question := btrim(coalesce(p_question, ''));
  IF char_length(v_question) < 20 THEN
    RAISE EXCEPTION 'question too short';
  END IF;
  IF char_length(v_question) > 280 THEN
    RAISE EXCEPTION 'question too long';
  END IF;
  IF left(lower(v_question), 12) <> lower('(Jeg mener) ') THEN
    RAISE EXCEPTION 'question must start with (Jeg mener)';
  END IF;

  SELECT coalesce(i.title, i.id)
  INTO v_issue_title
  FROM public.stortinget_issues i
  WHERE i.id = btrim(coalesce(p_stortinget_issue_id, ''));

  IF v_issue_title IS NULL THEN
    RAISE EXCEPTION 'issue not found';
  END IF;

  SELECT count(*)::integer
  INTO v_weekly_used
  FROM public.forum_prompts fp
  WHERE fp.submitted_by = p_user_id
    AND fp.created_at > now() - interval '7 days'
    AND coalesce(fp.topic_tags, '{}'::text[]) @> ARRAY['sak_mening']::text[];

  IF v_weekly_used >= v_weekly_limit THEN
    RAISE EXCEPTION 'weekly sak mening limit reached';
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
    stortinget_issue_id,
    submitted_by,
    submission_tier
  )
  VALUES (
    v_question,
    '[
      {"id":"ja","label":"Ja"},
      {"id":"nei","label":"Nei"}
    ]'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'title', v_issue_title,
        'url', 'https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=' || btrim(p_stortinget_issue_id),
        'outlet', 'Stortinget'
      )
    ),
    ARRAY['sak_mening']::text[],
    'low',
    'active',
    v_sort_order,
    now() + interval '30 days',
    btrim(p_stortinget_issue_id),
    p_user_id,
    'sak_mening'
  )
  RETURNING id INTO v_prompt_id;

  RETURN jsonb_build_object(
    'id', v_prompt_id,
    'status', 'active',
    'stortinget_issue_id', btrim(p_stortinget_issue_id)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_sak_mening_prompt(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_sak_mening_prompt(uuid, text, text) TO service_role;
