-- Batch aggregates for issue_stances (replaces citizen_votes on list/landing surfaces).

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
    result := result || jsonb_build_object(
      row.issue_id,
      jsonb_build_object(
        'for', row.enig_count,
        'against', row.uenig_count,
        'abstain', row.blank_count,
        'total', row.engaged_count
      )
    );
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_stance_totals_batch(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stance_totals_batch(text[]) TO service_role;
