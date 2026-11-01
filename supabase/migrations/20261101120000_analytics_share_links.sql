-- Personal share links + first-party analytics events (manual apply).

CREATE TABLE IF NOT EXISTS public.share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_kind text NOT NULL CHECK (target_kind IN ('poll', 'blog_post', 'sak', 'generic')),
  target_id text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS share_links_created_by_idx ON public.share_links (created_by);
CREATE INDEX IF NOT EXISTS share_links_target_idx ON public.share_links (target_kind, target_id);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_name text NOT NULL CHECK (char_length(event_name) BETWEEN 1 AND 64),
  path text NOT NULL,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  ref_code text,
  share_link_id uuid REFERENCES public.share_links (id) ON DELETE SET NULL,
  session_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS analytics_events_occurred_at_idx ON public.analytics_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_event_name_idx ON public.analytics_events (event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_share_link_idx ON public.analytics_events (share_link_id) WHERE share_link_id IS NOT NULL;

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.share_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.analytics_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.share_links TO service_role;
GRANT ALL ON TABLE public.analytics_events TO service_role;

-- insert_analytics_event: service_role only (from API route / edge)
CREATE OR REPLACE FUNCTION public.insert_analytics_event(p_row jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.analytics_events (
    event_name, path, referrer_host, utm_source, utm_medium, utm_campaign,
    ref_code, share_link_id, session_hash, metadata
  )
  VALUES (
    p_row->>'event_name',
    p_row->>'path',
    NULLIF(p_row->>'referrer_host', ''),
    NULLIF(p_row->>'utm_source', ''),
    NULLIF(p_row->>'utm_medium', ''),
    NULLIF(p_row->>'utm_campaign', ''),
    NULLIF(p_row->>'ref_code', ''),
    NULLIF(p_row->>'share_link_id', '')::uuid,
    NULLIF(p_row->>'session_hash', ''),
    COALESCE(p_row->'metadata', '{}'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.insert_analytics_event(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_analytics_event(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_user_metrics(p_admin_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_actor uuid;
  v_inactive_days int := 90;
  v_total bigint;
  v_new_7d bigint;
  v_signed_in_30d bigint;
  v_inactive bigint;
  v_stemme_plus bigint;
BEGIN
  v_actor := public.require_admin_user_id(p_admin_user_id);

  SELECT count(*) INTO v_total FROM auth.users;
  SELECT count(*) INTO v_new_7d FROM auth.users WHERE created_at >= now() - interval '7 days';
  SELECT count(*) INTO v_signed_in_30d FROM auth.users WHERE last_sign_in_at >= now() - interval '30 days';
  SELECT count(*) INTO v_inactive FROM auth.users
    WHERE last_sign_in_at IS NULL OR last_sign_in_at < now() - (v_inactive_days || ' days')::interval;
  SELECT count(*) INTO v_stemme_plus FROM public.users WHERE subscription_tier = 'stemme_plus';

  RETURN jsonb_build_object(
    'generatedAt', now(),
    'totalRegistered', v_total,
    'newLast7Days', v_new_7d,
    'signedInLast30Days', v_signed_in_30d,
    'inactiveApprox', v_inactive,
    'inactiveDaysThreshold', v_inactive_days,
    'stemmePlus', v_stemme_plus
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_user_metrics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user_metrics(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_share_link_stats(
  p_admin_user_id uuid,
  p_limit int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_actor uuid;
  v_rows jsonb;
BEGIN
  v_actor := public.require_admin_user_id(p_admin_user_id);
  p_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.clicks DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      sl.id,
      sl.code,
      sl.target_kind,
      sl.target_id,
      sl.label,
      sl.created_at,
      u.email AS creator_email,
      count(ae.id) AS clicks
    FROM public.share_links sl
    JOIN auth.users u ON u.id = sl.created_by
    LEFT JOIN public.analytics_events ae ON ae.share_link_id = sl.id AND ae.event_name = 'share_link_click'
    WHERE sl.revoked_at IS NULL
    GROUP BY sl.id, u.email
    ORDER BY clicks DESC
    LIMIT p_limit
  ) t;

  RETURN jsonb_build_object('generatedAt', now(), 'links', v_rows);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_share_link_stats(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_share_link_stats(uuid, int) TO service_role;

NOTIFY pgrst, 'reload schema';
