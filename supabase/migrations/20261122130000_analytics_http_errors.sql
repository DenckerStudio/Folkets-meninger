-- Aggregated Traefik/edge HTTP status counts + admin RPC (manual apply).
-- App-level http_error events stay in analytics_events (source=app/client).

CREATE TABLE IF NOT EXISTS public.analytics_http_daily (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket_date date NOT NULL,
  host text NOT NULL DEFAULT '',
  path_template text NOT NULL,
  status_code int NOT NULL CHECK (status_code >= 100 AND status_code <= 599),
  request_count bigint NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  is_bot boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'traefik' CHECK (source IN ('traefik')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_date, host, path_template, status_code, is_bot, source)
);

CREATE INDEX IF NOT EXISTS analytics_http_daily_bucket_date_idx
  ON public.analytics_http_daily (bucket_date DESC);

CREATE INDEX IF NOT EXISTS analytics_http_daily_status_idx
  ON public.analytics_http_daily (status_code, bucket_date DESC);

ALTER TABLE public.analytics_http_daily ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.analytics_http_daily FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.analytics_http_daily TO service_role;

-- Upsert daily aggregates from n8n / Vector (service_role only).
CREATE OR REPLACE FUNCTION public.n8n_upsert_analytics_http_daily(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_row jsonb;
  v_upserted int := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('upserted', 0);
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    INSERT INTO public.analytics_http_daily (
      bucket_date, host, path_template, status_code, request_count, is_bot, source, updated_at
    )
    VALUES (
      (v_row->>'bucket_date')::date,
      COALESCE(NULLIF(v_row->>'host', ''), ''),
      COALESCE(NULLIF(v_row->>'path_template', ''), '/'),
      (v_row->>'status_code')::int,
      GREATEST(COALESCE((v_row->>'request_count')::bigint, 0), 0),
      COALESCE((v_row->>'is_bot')::boolean, false),
      COALESCE(NULLIF(v_row->>'source', ''), 'traefik'),
      now()
    )
    ON CONFLICT (bucket_date, host, path_template, status_code, is_bot, source)
    DO UPDATE SET
      request_count = EXCLUDED.request_count,
      updated_at = now();

    v_upserted := v_upserted + 1;
  END LOOP;

  RETURN jsonb_build_object('upserted', v_upserted);
END;
$function$;

REVOKE ALL ON FUNCTION public.n8n_upsert_analytics_http_daily(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_upsert_analytics_http_daily(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_http_errors(
  p_admin_user_id uuid,
  p_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_actor uuid;
  v_days int;
  v_top_404 jsonb;
  v_status_classes jsonb;
  v_five_xx_by_day jsonb;
  v_total_human bigint;
  v_total_bot bigint;
BEGIN
  v_actor := public.require_admin_user_id(p_admin_user_id);
  v_days := GREATEST(1, LEAST(COALESCE(p_days, 30), 90));

  SELECT COALESCE(sum(request_count) FILTER (WHERE NOT is_bot), 0),
         COALESCE(sum(request_count) FILTER (WHERE is_bot), 0)
  INTO v_total_human, v_total_bot
  FROM public.analytics_http_daily
  WHERE bucket_date >= (current_date - make_interval(days => v_days - 1))::date
    AND status_code >= 400;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.request_count DESC), '[]'::jsonb)
  INTO v_top_404
  FROM (
    SELECT path_template, host, sum(request_count)::bigint AS request_count
    FROM public.analytics_http_daily
    WHERE bucket_date >= (current_date - make_interval(days => v_days - 1))::date
      AND status_code = 404
      AND NOT is_bot
    GROUP BY path_template, host
    ORDER BY sum(request_count) DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.status_class), '[]'::jsonb)
  INTO v_status_classes
  FROM (
    SELECT
      CASE
        WHEN status_code BETWEEN 200 AND 299 THEN '2xx'
        WHEN status_code BETWEEN 300 AND 399 THEN '3xx'
        WHEN status_code BETWEEN 400 AND 499 THEN '4xx'
        WHEN status_code BETWEEN 500 AND 599 THEN '5xx'
        ELSE 'other'
      END AS status_class,
      sum(request_count)::bigint AS request_count
    FROM public.analytics_http_daily
    WHERE bucket_date >= (current_date - make_interval(days => v_days - 1))::date
      AND NOT is_bot
    GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.bucket_date), '[]'::jsonb)
  INTO v_five_xx_by_day
  FROM (
    SELECT bucket_date, sum(request_count)::bigint AS request_count
    FROM public.analytics_http_daily
    WHERE bucket_date >= (current_date - make_interval(days => v_days - 1))::date
      AND status_code BETWEEN 500 AND 599
      AND NOT is_bot
    GROUP BY bucket_date
    ORDER BY bucket_date
  ) t;

  RETURN jsonb_build_object(
    'generatedAt', now(),
    'days', v_days,
    'source', 'traefik',
    'ready', true,
    'errorRowCountHuman', COALESCE(v_total_human, 0),
    'errorRowCountBot', COALESCE(v_total_bot, 0),
    'top404', v_top_404,
    'statusClasses', v_status_classes,
    'fiveXxByDay', v_five_xx_by_day
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_http_errors(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_http_errors(uuid, int) TO service_role;

-- Extend overview with app-sourced http_error aggregates from analytics_events.
CREATE OR REPLACE FUNCTION public.admin_get_analytics_overview(p_admin_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $function$
DECLARE
  v_actor uuid;
  v_page_views bigint;
  v_unique_visitors bigint;
  v_poll_landings bigint;
  v_share_clicks bigint;
  v_top_paths jsonb;
  v_channels jsonb;
  v_blog_paths jsonb;
  v_top_app_errors jsonb;
BEGIN
  v_actor := public.require_admin_user_id(p_admin_user_id);

  SELECT count(*) INTO v_page_views
  FROM public.analytics_events
  WHERE occurred_at >= now() - interval '30 days'
    AND event_name = 'page_view';

  SELECT count(DISTINCT session_hash) INTO v_unique_visitors
  FROM public.analytics_events
  WHERE occurred_at >= now() - interval '30 days'
    AND event_name = 'page_view'
    AND session_hash IS NOT NULL;

  SELECT count(*) INTO v_poll_landings
  FROM public.analytics_events
  WHERE occurred_at >= now() - interval '30 days'
    AND event_name = 'poll_share_landing';

  SELECT count(*) INTO v_share_clicks
  FROM public.analytics_events
  WHERE occurred_at >= now() - interval '30 days'
    AND event_name = 'share_link_click';

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.views DESC), '[]'::jsonb)
  INTO v_top_paths
  FROM (
    SELECT path, count(*) AS views
    FROM public.analytics_events
    WHERE occurred_at >= now() - interval '30 days'
      AND event_name = 'page_view'
    GROUP BY path
    ORDER BY views DESC
    LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.views DESC), '[]'::jsonb)
  INTO v_channels
  FROM (
    SELECT coalesce(metadata->>'bucket', 'direct') AS bucket, count(*) AS views
    FROM public.analytics_events
    WHERE occurred_at >= now() - interval '30 days'
      AND event_name = 'page_view'
    GROUP BY coalesce(metadata->>'bucket', 'direct')
    ORDER BY views DESC
    LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.views DESC), '[]'::jsonb)
  INTO v_blog_paths
  FROM (
    SELECT path, count(*) AS views
    FROM public.analytics_events
    WHERE occurred_at >= now() - interval '30 days'
      AND event_name = 'page_view'
      AND path LIKE '/blogg%'
    GROUP BY path
    ORDER BY views DESC
    LIMIT 15
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.count DESC), '[]'::jsonb)
  INTO v_top_app_errors
  FROM (
    SELECT
      path,
      COALESCE((metadata->>'status')::int, 0) AS status,
      count(*) AS count
    FROM public.analytics_events
    WHERE occurred_at >= now() - interval '30 days'
      AND event_name = 'http_error'
    GROUP BY path, COALESCE((metadata->>'status')::int, 0)
    ORDER BY count(*) DESC
    LIMIT 15
  ) t;

  RETURN jsonb_build_object(
    'generatedAt', now(),
    'pageViews', v_page_views,
    'uniqueVisitors', v_unique_visitors,
    'pollLandings', v_poll_landings,
    'shareClicks', v_share_clicks,
    'topPaths', v_top_paths,
    'channels', v_channels,
    'blogPaths', v_blog_paths,
    'topAppErrors', v_top_app_errors
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_analytics_overview(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_analytics_overview(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
