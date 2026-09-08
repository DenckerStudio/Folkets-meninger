-- New opinions must be For or Imot. Blank remains valid on replies and on
-- any existing opinion rows.

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
AS $function$
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

    IF char_length(v_point_text) < 12 OR char_length(v_point_text) > 180 THEN
      RAISE EXCEPTION 'Each opinion point must be between 12 and 180 characters';
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
$function$;

REVOKE ALL ON FUNCTION public.create_citizen_opinion(uuid, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_citizen_opinion(uuid, text, text, text, text, jsonb) TO service_role;
