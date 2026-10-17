-- Close C4: revoke anon/authenticated broad reads on public.users; expose names only via narrow RPC.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_public_display ON public.users;
DROP POLICY IF EXISTS users_select_own_subscription ON public.users;

REVOKE ALL ON TABLE public.users FROM anon;
REVOKE SELECT ON TABLE public.users FROM anon;
REVOKE SELECT (id, first_name, last_name, name) ON TABLE public.users FROM anon, authenticated;
REVOKE SELECT (subscription_tier, subscription_status, subscription_period_end) ON TABLE public.users FROM authenticated;

CREATE POLICY users_select_own_row
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

GRANT SELECT ON TABLE public.users TO authenticated;

CREATE OR REPLACE FUNCTION public.user_has_public_display_eligibility(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.citizen_opinions o
      WHERE o.author_user_id = p_user_id
        AND NOT o.is_removed
    )
    OR EXISTS (
      SELECT 1
      FROM public.citizen_opinion_replies r
      WHERE r.author_user_id = p_user_id
        AND NOT r.is_removed
    )
    OR EXISTS (
      SELECT 1
      FROM public.hearing_comments h
      WHERE h.author_user_id = p_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = p_user_id
        AND u.profile_is_public = true
    );
$$;

REVOKE ALL ON FUNCTION public.user_has_public_display_eligibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_public_display_eligibility(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_user_displays(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.first_name, u.last_name, u.name
  FROM public.users u
  WHERE p_user_ids IS NOT NULL
    AND u.id = ANY (p_user_ids)
    AND public.user_has_public_display_eligibility(u.id);
$$;

REVOKE ALL ON FUNCTION public.get_public_user_displays(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_user_displays(uuid[]) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_public_user_displays(uuid[]) IS
  'Returns display-name fields only for users with visible UGC or a public profile. Replaces direct SELECT on public.users for author joins.';
