-- Anonymous citizen voting: ballots (no user link) + encrypted receipts (user ↔ issue only)
-- Apply via Supabase SQL editor or: supabase db push

-- Supabase installs pgcrypto in the "extensions" schema (not public)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Store server-side secrets outside public schemas.
-- This avoids requiring ALTER DATABASE / ALTER SYSTEM privileges for custom GUCs.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

-- Issue metadata cache (also used when casting votes)
CREATE TABLE IF NOT EXISTS public.stortinget_issues (
  id text PRIMARY KEY,
  title text,
  summary text,
  status text DEFAULT 'pending',
  last_synced_at timestamptz,
  detail_json jsonb,
  ai_summary_json jsonb,
  ai_summary_generated_at timestamptz
);

-- Anonymous ballots — no user_id column
CREATE TABLE IF NOT EXISTS public.citizen_votes (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  stortinget_issue_id text NOT NULL REFERENCES public.stortinget_issues (id) ON DELETE CASCADE,
  choice text NOT NULL CHECK (choice IN ('for', 'against', 'abstain')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_citizen_votes_issue ON public.citizen_votes (stortinget_issue_id);

-- Per-user receipt: proves they voted; choice stored encrypted (not in ballot table)
CREATE TABLE IF NOT EXISTS public.user_vote_receipts (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  stortinget_issue_id text NOT NULL REFERENCES public.stortinget_issues (id) ON DELETE CASCADE,
  choice_encrypted bytea NOT NULL,
  voted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, stortinget_issue_id)
);

CREATE INDEX IF NOT EXISTS idx_user_vote_receipts_user ON public.user_vote_receipts (user_id);

-- Optional identity gate (BankID etc. can set identity_verified = true later)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  identity_verified boolean NOT NULL DEFAULT true,
  verified_at timestamptz
);

ALTER TABLE public.stortinget_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citizen_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vote_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- No direct ballot reads from clients (aggregates only via RPC)
DROP POLICY IF EXISTS citizen_votes_deny_all ON public.citizen_votes;
CREATE POLICY citizen_votes_deny_all ON public.citizen_votes
  FOR ALL TO authenticated, anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS user_vote_receipts_select_own ON public.user_vote_receipts;
CREATE POLICY user_vote_receipts_select_own ON public.user_vote_receipts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;
CREATE POLICY user_profiles_update_own ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS stortinget_issues_select_all ON public.stortinget_issues;
CREATE POLICY stortinget_issues_select_all ON public.stortinget_issues
  FOR SELECT TO authenticated, anon
  USING (true);

-- CREATE OR REPLACE cannot change return type; drop every legacy overload (signatures differ per project)
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'cast_vote',
        'get_user_vote_history',
        'get_user_vote_on_issue',
        'get_vote_totals_batch',
        'get_issue_vote_totals',
        'decrypt_vote_choice',
        'encrypt_vote_choice',
        'vote_encryption_key'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', fn);
  END LOOP;
END $$;

-- Server-side secret used as pepper for vote receipt encryption.
-- Set once manually (SQL Editor) as a privileged role:
--   INSERT INTO private.app_settings (key, value)
--   VALUES ('vote_encryption_secret', '<random>') ON CONFLICT (key) DO UPDATE SET value = excluded.value;
CREATE TABLE IF NOT EXISTS private.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE private.app_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION private.get_setting(p_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT value FROM private.app_settings WHERE key = p_key;
$$;

REVOKE ALL ON FUNCTION private.get_setting(text) FROM anon, authenticated;

-- Derive per-user encryption key material.
CREATE OR REPLACE FUNCTION public.vote_encryption_key(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT encode(
    extensions.digest(
      convert_to(
        p_user_id::text || coalesce(
          private.get_setting('vote_encryption_secret'),
          current_setting('app.vote_encryption_secret', true),
          'folkets-stemme-dev-pepper-change-in-production'
        ),
        'UTF8'
      ),
      'sha256'::text
    ),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.encrypt_vote_choice(p_user_id uuid, p_choice text)
RETURNS bytea
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT extensions.pgp_sym_encrypt(
    p_choice,
    public.vote_encryption_key(p_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.decrypt_vote_choice(p_user_id uuid, p_encrypted bytea)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT extensions.pgp_sym_decrypt(
    p_encrypted,
    public.vote_encryption_key(p_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_issue_vote_totals(p_issue_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_for int;
  v_against int;
  v_abstain int;
BEGIN
  SELECT
    count(*) FILTER (WHERE choice = 'for'),
    count(*) FILTER (WHERE choice = 'against'),
    count(*) FILTER (WHERE choice = 'abstain')
  INTO v_for, v_against, v_abstain
  FROM public.citizen_votes
  WHERE stortinget_issue_id = p_issue_id;

  RETURN jsonb_build_object(
    'for', coalesce(v_for, 0),
    'against', coalesce(v_against, 0),
    'abstain', coalesce(v_abstain, 0),
    'total', coalesce(v_for, 0) + coalesce(v_against, 0) + coalesce(v_abstain, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vote_totals_batch(p_issue_ids text[])
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
      count(*) FILTER (WHERE choice = 'for') AS for_count,
      count(*) FILTER (WHERE choice = 'against') AS against_count,
      count(*) FILTER (WHERE choice = 'abstain') AS abstain_count,
      count(*) AS total_count
    FROM public.citizen_votes
    WHERE stortinget_issue_id = ANY (p_issue_ids)
    GROUP BY stortinget_issue_id
  LOOP
    result := result || jsonb_build_object(
      row.issue_id,
      jsonb_build_object(
        'for', row.for_count,
        'against', row.against_count,
        'abstain', row.abstain_count,
        'total', row.total_count
      )
    );
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_vote_on_issue(p_user_id uuid, p_issue_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted bytea;
  v_choice text;
BEGIN
  SELECT choice_encrypted INTO v_encrypted
  FROM public.user_vote_receipts
  WHERE user_id = p_user_id AND stortinget_issue_id = p_issue_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('hasVoted', false);
  END IF;

  v_choice := public.decrypt_vote_choice(p_user_id, v_encrypted);

  RETURN jsonb_build_object(
    'hasVoted', true,
    'vote', v_choice
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_vote_history(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'stortinget_issue_id', r.stortinget_issue_id,
          'title', coalesce(i.title, 'Sak ' || r.stortinget_issue_id),
          'voted_at', r.voted_at
        )
        ORDER BY r.voted_at DESC
      )
      FROM public.user_vote_receipts r
      LEFT JOIN public.stortinget_issues i ON i.id = r.stortinget_issue_id
      WHERE r.user_id = p_user_id
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cast_vote(
  p_user_id uuid,
  p_issue_id text,
  p_choice text,
  p_title text DEFAULT NULL,
  p_summary text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_choice IS NULL OR p_choice NOT IN ('for', 'against', 'abstain') THEN
    RAISE EXCEPTION 'Invalid vote choice';
  END IF;

  INSERT INTO public.user_profiles (user_id, identity_verified, verified_at)
  VALUES (p_user_id, true, now())
  ON CONFLICT (user_id) DO UPDATE
  SET identity_verified = true,
      verified_at = coalesce(public.user_profiles.verified_at, now());

  IF EXISTS (
    SELECT 1 FROM public.user_vote_receipts
    WHERE user_id = p_user_id AND stortinget_issue_id = p_issue_id
  ) THEN
    RAISE EXCEPTION 'Already voted';
  END IF;

  INSERT INTO public.stortinget_issues (id, title, summary, last_synced_at)
  VALUES (
    p_issue_id,
    coalesce(p_title, 'Sak ' || p_issue_id),
    p_summary,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = coalesce(excluded.title, public.stortinget_issues.title),
    summary = coalesce(excluded.summary, public.stortinget_issues.summary),
    last_synced_at = now();

  INSERT INTO public.citizen_votes (stortinget_issue_id, choice)
  VALUES (p_issue_id, p_choice);

  INSERT INTO public.user_vote_receipts (user_id, stortinget_issue_id, choice_encrypted)
  VALUES (p_user_id, p_issue_id, public.encrypt_vote_choice(p_user_id, p_choice));

  RETURN public.get_issue_vote_totals(p_issue_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_vote(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_issue_vote_totals(text) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vote_totals_batch(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_vote_on_issue(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_vote_history(uuid) TO service_role;
