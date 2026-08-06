-- Base profile tables missing from the original incremental chain (hosted DBs were
-- bootstrapped manually / via NextAuth). Required before forum FKs and auth sync.

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name text,
  email text,
  first_name text,
  last_name text,
  bio text,
  party_preference text,
  profile_is_public boolean NOT NULL DEFAULT false,
  show_party_preference boolean NOT NULL DEFAULT false,
  show_points boolean NOT NULL DEFAULT true,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.politician_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  stortinget_rep_id text NOT NULL UNIQUE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.politician_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.politician_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_profile_id uuid NOT NULL REFERENCES public.politician_profiles (id) ON DELETE CASCADE,
  stortinget_issue_id text NOT NULL REFERENCES public.stortinget_issues (id) ON DELETE CASCADE,
  content text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS politician_responses_issue_idx
  ON public.politician_responses (stortinget_issue_id, published_at DESC);

ALTER TABLE public.politician_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS politician_profiles_select ON public.politician_profiles;
CREATE POLICY politician_profiles_select ON public.politician_profiles
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS politician_responses_select ON public.politician_responses;
CREATE POLICY politician_responses_select ON public.politician_responses
  FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT ON public.politician_profiles TO anon, authenticated;
GRANT SELECT ON public.politician_responses TO anon, authenticated;
