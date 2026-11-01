-- Admin analytics overview aggregates (manual apply).

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

  RETURN jsonb_build_object(
    'generatedAt', now(),
    'pageViews', v_page_views,
    'uniqueVisitors', v_unique_visitors,
    'pollLandings', v_poll_landings,
    'shareClicks', v_share_clicks,
    'topPaths', v_top_paths,
    'channels', v_channels,
    'blogPaths', v_blog_paths
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_analytics_overview(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_analytics_overview(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
