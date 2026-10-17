-- C1: suppress public stance aggregates below k-anonymity threshold (matches STANCE_PUBLIC_MIN_ENGAGED = 5 in app).

CREATE OR REPLACE FUNCTION public.get_stance_totals_batch(p_issue_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  row record;
  min_engaged constant int := 5;
BEGIN
  IF p_issue_ids IS NULL OR array_length(p_issue_ids, 1) IS NULL THEN
    RETURN result;
  END IF;

  FOR row IN
    SELECT
      stortinget_issue_id AS issue_id,
      count(*) FILTER (WHERE stance = 'enig') AS enig_count,
      count(*) FILTER (WHERE stance = 'uenig') AS uenig_count,
      count(*) FILTER (WHERE stance = 'ikke_interessert') AS blank_count,
      count(*) FILTER (WHERE stance IN ('enig', 'uenig')) AS engaged_count
    FROM public.issue_stances
    WHERE stortinget_issue_id = ANY (p_issue_ids)
    GROUP BY stortinget_issue_id
  LOOP
    IF row.engaged_count < min_engaged THEN
      result := result || jsonb_build_object(
        row.issue_id,
        jsonb_build_object(
          'suppressed', true,
          'for', 0,
          'against', 0,
          'abstain', 0,
          'total', 0
        )
      );
    ELSE
      result := result || jsonb_build_object(
        row.issue_id,
        jsonb_build_object(
          'suppressed', false,
          'for', row.enig_count,
          'against', row.uenig_count,
          'abstain', row.blank_count,
          'total', row.engaged_count
        )
      );
    END IF;
  END LOOP;

  RETURN result;
END;
$$;
