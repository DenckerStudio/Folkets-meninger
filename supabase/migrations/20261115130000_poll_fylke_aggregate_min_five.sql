-- Align per-fylke poll aggregate floor with app MIN_PUBLIC_AGGREGATE_N (5).

CREATE OR REPLACE FUNCTION public.get_poll_totals_by_fylke(
  p_poll_id uuid,
  p_min_votes int DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  row record;
  v_min int := greatest(coalesce(p_min_votes, 5), 5);
BEGIN
  IF NOT public.poll_allows_public_aggregate(p_poll_id) THEN
    RETURN '[]'::jsonb;
  END IF;

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

COMMENT ON FUNCTION public.get_poll_totals_by_fylke(uuid, int) IS
  'Per-fylke aggregates; counties below min votes return null choice counts (k-anonymity floor 5).';

REVOKE ALL ON FUNCTION public.get_poll_totals_by_fylke(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_poll_totals_by_fylke(uuid, int) TO anon, authenticated, service_role;