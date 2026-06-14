-- Allow public forum/profile reads to resolve author display names without exposing email.

DROP POLICY IF EXISTS users_select_public_display ON public.users;
CREATE POLICY users_select_public_display
  ON public.users
  FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT (id, first_name, last_name, name) ON public.users TO anon, authenticated;
