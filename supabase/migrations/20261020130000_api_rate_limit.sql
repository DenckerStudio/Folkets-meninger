-- Shared API rate limits (H-1): unlogged buckets + service_role RPC for all app instances.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE UNLOGGED TABLE IF NOT EXISTS public.api_rate_limit_buckets (
  bucket_key text NOT NULL PRIMARY KEY,
  hit_count integer NOT NULL,
  window_reset_at timestamptz NOT NULL
);

COMMENT ON TABLE public.api_rate_limit_buckets IS
  'Ephemeral per-key counters for API/middleware rate limiting (unlogged; not replicated).';

REVOKE ALL ON TABLE public.api_rate_limit_buckets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_rate_limit_buckets TO service_role;

ALTER TABLE public.api_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_reset timestamptz;
  v_ok boolean;
  v_retry integer;
BEGIN
  IF p_bucket_key IS NULL OR length(btrim(p_bucket_key)) = 0 THEN
    RAISE EXCEPTION 'Missing bucket key';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid limit or window';
  END IF;

  INSERT INTO public.api_rate_limit_buckets AS b (bucket_key, hit_count, window_reset_at)
  VALUES (
    left(btrim(p_bucket_key), 512),
    1,
    v_now + make_interval(secs => p_window_seconds)
  )
  ON CONFLICT (bucket_key) DO UPDATE SET
    hit_count = CASE
      WHEN b.window_reset_at <= v_now THEN 1
      ELSE b.hit_count + 1
    END,
    window_reset_at = CASE
      WHEN b.window_reset_at <= v_now THEN v_now + make_interval(secs => p_window_seconds)
      ELSE b.window_reset_at
    END
  RETURNING b.hit_count, b.window_reset_at INTO v_count, v_reset;

  v_ok := v_count <= p_limit;
  IF v_ok THEN
    v_retry := 0;
  ELSE
    v_retry := greatest(1, ceil(extract(epoch FROM (v_reset - v_now)))::integer);
  END IF;

  RETURN jsonb_build_object(
    'ok', v_ok,
    'remaining', greatest(0, p_limit - v_count),
    'retryAfterSeconds', v_retry
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.check_api_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_api_rate_limit(text, integer, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
