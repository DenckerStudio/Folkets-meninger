-- Veteran users can suggest new trusted news sources for admin review.

ALTER TABLE public.forum_trusted_sources
  ADD COLUMN IF NOT EXISTS suggested_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS forum_trusted_sources_suggested_by_idx
  ON public.forum_trusted_sources (suggested_by, created_at DESC)
  WHERE suggested_by IS NOT NULL;

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

REVOKE ALL ON FUNCTION public.suggest_trusted_news_source(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_trusted_news_source(uuid, text, text) TO service_role;
