-- Purge first-party analytics_events older than N days (manual apply).
-- Default retention: 365 days (lib/analytics/retention.ts / personvern).

CREATE OR REPLACE FUNCTION public.purge_analytics_events_older_than(p_days int DEFAULT 365)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_days int;
  v_deleted bigint;
BEGIN
  v_days := GREATEST(30, LEAST(COALESCE(p_days, 365), 3650));

  WITH deleted AS (
    DELETE FROM public.analytics_events
    WHERE occurred_at < now() - make_interval(days => v_days)
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM deleted;

  RETURN jsonb_build_object(
    'deleted', v_deleted,
    'retentionDays', v_days,
    'purgedAt', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_analytics_events_older_than(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_analytics_events_older_than(int) TO service_role;

NOTIFY pgrst, 'reload schema';
