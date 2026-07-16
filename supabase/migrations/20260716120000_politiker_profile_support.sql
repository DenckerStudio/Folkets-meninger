-- Politiker profile queries and response security hardening

CREATE OR REPLACE FUNCTION public.get_politiker_saker_from_cache(p_stortinget_rep_id text)
RETURNS TABLE (
  id text,
  title text,
  category text,
  sak_kind text,
  status text,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    si.id,
    si.title,
    si.category,
    si.sak_kind,
    si.status,
    'forslagstiller'::text AS role
  FROM public.stortinget_issues si
  WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(si.detail_json->'sak_opphav'->'forslagstiller_liste', '[]'::jsonb)) AS f
    WHERE f->>'id' = p_stortinget_rep_id
  )
  UNION ALL
  SELECT
    si.id,
    si.title,
    si.category,
    si.sak_kind,
    si.status,
    'saksordfoerer'::text AS role
  FROM public.stortinget_issues si
  WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(si.detail_json->'saksordfoerer_liste', '[]'::jsonb)) AS s
    WHERE s->>'id' = p_stortinget_rep_id
  )
  ORDER BY status ASC, title ASC;
$$;

REVOKE ALL ON FUNCTION public.get_politiker_saker_from_cache(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_politiker_saker_from_cache(text) TO service_role;

-- One official response per politician per sak
CREATE UNIQUE INDEX IF NOT EXISTS politician_responses_profile_issue_uidx
  ON public.politician_responses (politician_profile_id, stortinget_issue_id);

-- Prefer Supabase auth.uid() over legacy next_auth.uid() for inserts
DROP POLICY IF EXISTS politician_responses_insert_verified ON public.politician_responses;
CREATE POLICY politician_responses_insert_verified
  ON public.politician_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.politician_profiles pp
      WHERE pp.id = politician_profile_id
        AND pp.user_id = auth.uid()
    )
  );
