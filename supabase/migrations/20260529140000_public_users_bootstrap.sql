-- public.users is referenced from 20260529150000_users_auth_sync onward; full columns
-- are added in later migrations (e.g. forum_public_identity). Bootstrap minimal table.
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  name text,
  email text
);
