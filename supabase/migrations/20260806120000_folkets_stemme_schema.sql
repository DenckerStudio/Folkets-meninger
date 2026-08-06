-- Folkets Stemme — squashed schema for local Supabase (`supabase db reset`).
-- Built from incremental migrations in supabase/migrations_legacy/.
-- Regenerate: node scripts/build-local-schema.mjs
-- Do not apply to hosted DBs that already ran the incremental history.

-- >>> BEGIN 20260528000001_anonymous_voting.sql
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
-- <<< END 20260528000001_anonymous_voting.sql

-- >>> BEGIN 20260528000002_vote_schema_repair.sql
-- Repair common issues after partial migrations or legacy schema
-- Run this if voting returns 500 or "function name cast_vote is not unique"

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

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

CREATE TABLE IF NOT EXISTS public.citizen_votes (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  stortinget_issue_id text NOT NULL REFERENCES public.stortinget_issues (id) ON DELETE CASCADE,
  choice text NOT NULL CHECK (choice IN ('for', 'against', 'abstain')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1. Legacy citizen_votes may still have user_id (breaks anonymous INSERT)
ALTER TABLE public.citizen_votes DROP COLUMN IF EXISTS user_id;

-- 2. Ensure receipt table exists (skip if 20260528000001 already applied fully)
CREATE TABLE IF NOT EXISTS public.user_vote_receipts (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  stortinget_issue_id text NOT NULL REFERENCES public.stortinget_issues (id) ON DELETE CASCADE,
  choice_encrypted bytea NOT NULL,
  voted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, stortinget_issue_id)
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  identity_verified boolean NOT NULL DEFAULT true,
  verified_at timestamptz
);

-- 3. Drop every vote RPC overload, then recreate a single canonical version
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
SET search_path = public, extensions
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

  -- Always allow logged-in users to vote (BankID can tighten this later)
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
-- <<< END 20260528000002_vote_schema_repair.sql

-- >>> BEGIN 20260528000003_notifications.sql
-- In-app + email notifications (preferences, subscriptions, inbox)
-- Apply via Supabase SQL editor or: supabase db push

-- We rely on extensions.gen_random_uuid() from pgcrypto installed in earlier migrations.

-- Per-user notification preferences.
-- email_frequency_by_channel example:
-- {
--   "forum": "realtime",
--   "mentions": "realtime",
--   "categories": "daily"
-- }
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  email_frequency_by_channel jsonb NOT NULL DEFAULT jsonb_build_object(
    'forum', 'realtime',
    'mentions', 'realtime',
    'categories', 'daily'
  ),
  last_digest_sent_at_by_channel jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Categories a user subscribes to (hjertesaker).
CREATE TABLE IF NOT EXISTS public.notification_category_subscriptions (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

-- Notification inbox items.
-- channel is the preference bucket (forum/mentions/categories/etc).
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL,
  channel text NOT NULL,
  title text NOT NULL,
  body text,
  url text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  emailed_at timestamptz,
  email_last_error text
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at
  ON public.notifications (user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_channel_created_at
  ON public.notifications (channel, created_at DESC);

-- Keep updated_at current.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_category_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- notification_preferences: user manages their own.
DROP POLICY IF EXISTS notification_preferences_select_own ON public.notification_preferences;
CREATE POLICY notification_preferences_select_own
  ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_preferences_insert_own ON public.notification_preferences;
CREATE POLICY notification_preferences_insert_own
  ON public.notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_preferences_update_own ON public.notification_preferences;
CREATE POLICY notification_preferences_update_own
  ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- notification_category_subscriptions: user manages their own.
DROP POLICY IF EXISTS notification_category_subscriptions_select_own ON public.notification_category_subscriptions;
CREATE POLICY notification_category_subscriptions_select_own
  ON public.notification_category_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_category_subscriptions_insert_own ON public.notification_category_subscriptions;
CREATE POLICY notification_category_subscriptions_insert_own
  ON public.notification_category_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_category_subscriptions_delete_own ON public.notification_category_subscriptions;
CREATE POLICY notification_category_subscriptions_delete_own
  ON public.notification_category_subscriptions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- notifications inbox: user can read and mark read for their own.
-- Inserts are done via service_role (server) or via secured RPCs if added later.
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_deny_inserts_from_clients ON public.notifications;
CREATE POLICY notifications_deny_inserts_from_clients
  ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS notifications_deny_deletes_from_clients ON public.notifications;
CREATE POLICY notifications_deny_deletes_from_clients
  ON public.notifications
  FOR DELETE TO authenticated
  USING (false);
-- <<< END 20260528000003_notifications.sql

-- >>> BEGIN 20260528120000_issue_ai_summaries.sql
-- Godkjente AI-sammendrag per stortingssak (hva / hvem / kostnad)
create table if not exists public.issue_ai_summaries (
  stortinget_issue_id text primary key,
  hva text not null,
  hvem text not null,
  kostnad text not null,
  context_hash text not null,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists issue_ai_summaries_approved_at_idx
  on public.issue_ai_summaries (approved_at desc);

alter table public.issue_ai_summaries enable row level security;

create policy "issue_ai_summaries_select_anon"
  on public.issue_ai_summaries
  for select
  to anon, authenticated
  using (true);

comment on table public.issue_ai_summaries is
  'Godkjente, validerte AI-sammendrag (hva/hvem/kostnad) per stortinget_issue_id';
-- <<< END 20260528120000_issue_ai_summaries.sql

-- >>> BEGIN 20260529120000_simplify_issue_ai_summaries.sql
-- AI summaries are generated only by n8n + Ollama; app reads issue_ai_summaries.

drop index if exists public.issue_ai_summaries_approved_at_idx;

alter table public.issue_ai_summaries
  drop column if exists context_hash,
  drop column if exists approved_at;

alter table public.stortinget_issues
  drop column if exists ai_summary_json,
  drop column if exists ai_summary_generated_at;

-- Legacy per-field / dynamic-card columns (not used by n8n hva/hvem/kostnad flow)
alter table public.issue_ai_summaries
  drop column if exists hva_approved_at,
  drop column if exists hvem_approved_at,
  drop column if exists kostnad_approved_at,
  drop column if exists cards_json,
  drop column if exists cards_approved_at;

comment on table public.issue_ai_summaries is
  'AI-sammendrag (hva/hvem/kostnad) per stortinget_issue_id, skrevet av n8n-workflow.';
-- <<< END 20260529120000_simplify_issue_ai_summaries.sql

-- >>> BEGIN 20260529150000_users_auth_sync.sql
-- Sync public.users with Supabase Auth (auth.users), not legacy next_auth.users

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.ensure_public_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_name text;
  v_email text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found in auth.users';
  END IF;

  SELECT
    COALESCE(
      NULLIF(trim(raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(raw_user_meta_data->>'name'), ''),
      NULLIF(trim(raw_user_meta_data->>'user_name'), ''),
      NULLIF(split_part(email, '@', 1), '')
    ),
    email
  INTO v_name, v_email
  FROM auth.users
  WHERE id = p_user_id;

  INSERT INTO public.users (id, name, email)
  VALUES (p_user_id, v_name, v_email)
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, public.users.name),
    email = COALESCE(EXCLUDED.email, public.users.email);
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_public_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_public_user(uuid) TO service_role;

-- Forum RPCs: ensure profile exists before write
CREATE OR REPLACE FUNCTION public.create_forum_thread(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_stortinget_issue_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_thread_id uuid;
  v_title text;
  v_body text;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  v_title := btrim(p_title);
  v_body := btrim(p_body);

  IF char_length(v_title) < 3 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 3 and 200 characters';
  END IF;

  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  IF p_stortinget_issue_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.stortinget_issues WHERE id = p_stortinget_issue_id
  ) THEN
    RAISE EXCEPTION 'Unknown stortinget issue';
  END IF;

  INSERT INTO public.forum_threads (title, body, stortinget_issue_id, author_user_id)
  VALUES (v_title, v_body, p_stortinget_issue_id, p_user_id)
  RETURNING id INTO v_thread_id;

  RETURN v_thread_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_forum_reply(
  p_user_id uuid,
  p_thread_id uuid,
  p_body text,
  p_parent_reply_id uuid DEFAULT NULL,
  p_is_official_response boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_reply_id uuid;
  v_body text;
  v_is_official boolean;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF p_parent_reply_id IS NOT NULL THEN
    RAISE EXCEPTION 'Nested replies are not supported';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.forum_threads WHERE id = p_thread_id) THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  v_body := btrim(p_body);

  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  v_is_official := COALESCE(p_is_official_response, false);

  IF v_is_official AND NOT EXISTS (
    SELECT 1 FROM public.politician_profiles WHERE user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Only verified politicians can post official responses';
  END IF;

  INSERT INTO public.forum_replies (thread_id, body, author_user_id, parent_reply_id, is_official_response)
  VALUES (p_thread_id, v_body, p_user_id, NULL, v_is_official)
  RETURNING id INTO v_reply_id;

  IF v_is_official THEN
    UPDATE public.forum_threads
    SET is_resolved = true
    WHERE id = p_thread_id;
  END IF;

  RETURN v_reply_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_forum_like(
  p_user_id uuid,
  p_target_type text,
  p_target_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_exists boolean;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF p_target_type NOT IN ('thread', 'reply') THEN
    RAISE EXCEPTION 'Invalid target type';
  END IF;

  IF p_target_type = 'thread' THEN
    IF NOT EXISTS (SELECT 1 FROM public.forum_threads WHERE id = p_target_id) THEN
      RAISE EXCEPTION 'Thread not found';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.forum_replies WHERE id = p_target_id) THEN
      RAISE EXCEPTION 'Reply not found';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.forum_likes
    WHERE user_id = p_user_id
      AND target_type = p_target_type
      AND target_id = p_target_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.forum_likes
    WHERE user_id = p_user_id
      AND target_type = p_target_type
      AND target_id = p_target_id;
    RETURN false;
  ELSE
    INSERT INTO public.forum_likes (user_id, target_type, target_id)
    VALUES (p_user_id, p_target_type, p_target_id);
    RETURN true;
  END IF;
END;
$function$;

-- Hearing comments use the same public.users FK
CREATE OR REPLACE FUNCTION public.create_hearing_comment(
  p_user_id uuid,
  p_hearing_id uuid,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_comment_id uuid;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.hearing_comments (hearing_id, body, author_user_id)
  VALUES (p_hearing_id, p_body, p_user_id)
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_hearing_comment(uuid, uuid, text) TO service_role;
-- <<< END 20260529150000_users_auth_sync.sql

-- >>> BEGIN 20260530120000_forum_enhancements.sql
-- Forum base schema, enhancements, and trending prompts

CREATE TABLE IF NOT EXISTS public.forum_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  stortinget_issue_id text REFERENCES public.stortinget_issues (id) ON DELETE SET NULL,
  author_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  is_resolved boolean NOT NULL DEFAULT false,
  is_system_thread boolean NOT NULL DEFAULT false,
  context_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads (id) ON DELETE CASCADE,
  body text NOT NULL,
  author_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  parent_reply_id uuid REFERENCES public.forum_replies (id) ON DELETE SET NULL,
  is_official_response boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forum_likes (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('thread', 'reply')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);

ALTER TABLE public.forum_threads
  ADD COLUMN IF NOT EXISTS is_system_thread boolean NOT NULL DEFAULT false;

ALTER TABLE public.forum_threads
  ADD COLUMN IF NOT EXISTS context_items jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS forum_threads_created_at_idx ON public.forum_threads (created_at DESC);
CREATE INDEX IF NOT EXISTS forum_threads_issue_idx ON public.forum_threads (stortinget_issue_id);
CREATE INDEX IF NOT EXISTS forum_replies_thread_idx ON public.forum_replies (thread_id);

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forum_threads_select ON public.forum_threads;
CREATE POLICY forum_threads_select ON public.forum_threads FOR SELECT USING (true);

DROP POLICY IF EXISTS forum_replies_select ON public.forum_replies;
CREATE POLICY forum_replies_select ON public.forum_replies FOR SELECT USING (true);

DROP POLICY IF EXISTS forum_likes_select ON public.forum_likes;
CREATE POLICY forum_likes_select ON public.forum_likes FOR SELECT USING (true);

-- System-spawnede tråder: author_user_id NULL + is_system_thread (ingen rad i auth.users)

-- forum_prompts
CREATE TABLE IF NOT EXISTS public.forum_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_headlines jsonb NOT NULL DEFAULT '[]'::jsonb,
  topic_tags text[] NOT NULL DEFAULT '{}',
  sensitivity text NOT NULL DEFAULT 'low' CHECK (sensitivity IN ('low', 'high')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  sort_order int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  discuss_click_count int NOT NULL DEFAULT 0,
  discuss_threshold int NOT NULL DEFAULT 10,
  spawned_thread_id uuid REFERENCES public.forum_threads (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forum_prompt_votes (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES public.forum_prompts (id) ON DELETE CASCADE,
  option_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, prompt_id)
);

CREATE TABLE IF NOT EXISTS public.forum_prompt_discuss_clicks (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  prompt_id uuid NOT NULL REFERENCES public.forum_prompts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, prompt_id)
);

CREATE INDEX IF NOT EXISTS forum_prompts_status_idx ON public.forum_prompts (status, sort_order);
CREATE INDEX IF NOT EXISTS forum_prompts_expires_idx ON public.forum_prompts (expires_at);

ALTER TABLE public.forum_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_prompt_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_prompt_discuss_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forum_prompts_select ON public.forum_prompts;
CREATE POLICY forum_prompts_select ON public.forum_prompts
  FOR SELECT USING (status = 'active' AND (expires_at IS NULL OR expires_at > now()));

DROP POLICY IF EXISTS forum_prompt_votes_select ON public.forum_prompt_votes;
CREATE POLICY forum_prompt_votes_select ON public.forum_prompt_votes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS forum_prompt_discuss_clicks_select ON public.forum_prompt_discuss_clicks;
CREATE POLICY forum_prompt_discuss_clicks_select ON public.forum_prompt_discuss_clicks
  FOR SELECT USING (auth.uid() = user_id);

-- Updated create_forum_thread with context_items
CREATE OR REPLACE FUNCTION public.create_forum_thread(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_stortinget_issue_id text DEFAULT NULL,
  p_context_items jsonb DEFAULT '[]'::jsonb,
  p_is_system_thread boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_thread_id uuid;
  v_title text;
  v_body text;
BEGIN
  IF NOT COALESCE(p_is_system_thread, false) THEN
    PERFORM public.ensure_public_user(p_user_id);
  END IF;

  v_title := btrim(p_title);
  v_body := btrim(p_body);

  IF char_length(v_title) < 3 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 3 and 200 characters';
  END IF;

  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  IF p_stortinget_issue_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.stortinget_issues WHERE id = p_stortinget_issue_id
  ) THEN
    RAISE EXCEPTION 'Unknown stortinget issue';
  END IF;

  INSERT INTO public.forum_threads (
    title, body, stortinget_issue_id, author_user_id, context_items, is_system_thread
  )
  VALUES (
    v_title, v_body, p_stortinget_issue_id, p_user_id,
    COALESCE(p_context_items, '[]'::jsonb),
    COALESCE(p_is_system_thread, false)
  )
  RETURNING id INTO v_thread_id;

  RETURN v_thread_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cast_prompt_vote(
  p_user_id uuid,
  p_prompt_id uuid,
  p_option_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_prompt public.forum_prompts%ROWTYPE;
  v_option_exists boolean;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  SELECT * INTO v_prompt FROM public.forum_prompts
  WHERE id = p_prompt_id AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prompt not found or inactive';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_prompt.options) opt
    WHERE opt->>'id' = p_option_id
  ) INTO v_option_exists;

  IF NOT v_option_exists THEN
    RAISE EXCEPTION 'Invalid option';
  END IF;

  INSERT INTO public.forum_prompt_votes (user_id, prompt_id, option_id)
  VALUES (p_user_id, p_prompt_id, p_option_id)
  ON CONFLICT (user_id, prompt_id) DO UPDATE SET option_id = EXCLUDED.option_id;

  RETURN public.get_prompt_results(p_prompt_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_prompt_results(p_prompt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prompt public.forum_prompts%ROWTYPE;
  v_total int;
  v_results jsonb := '[]'::jsonb;
  v_opt record;
  v_count int;
BEGIN
  SELECT * INTO v_prompt FROM public.forum_prompts WHERE id = p_prompt_id;
  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT count(*) INTO v_total FROM public.forum_prompt_votes WHERE prompt_id = p_prompt_id;

  FOR v_opt IN SELECT value FROM jsonb_array_elements(v_prompt.options) AS t(value)
  LOOP
    SELECT count(*) INTO v_count
    FROM public.forum_prompt_votes
    WHERE prompt_id = p_prompt_id AND option_id = v_opt.value->>'id';

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'id', v_opt.value->>'id',
      'label', v_opt.value->>'label',
      'count', v_count,
      'percent', CASE WHEN v_total > 0 THEN round((v_count::numeric / v_total) * 100) ELSE 0 END
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'options', v_results,
    'discuss_click_count', v_prompt.discuss_click_count,
    'discuss_threshold', v_prompt.discuss_threshold,
    'spawned_thread_id', v_prompt.spawned_thread_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_prompt_discuss_click(
  p_user_id uuid,
  p_prompt_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_prompt public.forum_prompts%ROWTYPE;
  v_thread_id uuid;
  v_body text;
  v_results jsonb;
  v_headline jsonb;
  v_sources text := '';
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  SELECT * INTO v_prompt FROM public.forum_prompts
  WHERE id = p_prompt_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prompt not found';
  END IF;

  INSERT INTO public.forum_prompt_discuss_clicks (user_id, prompt_id)
  VALUES (p_user_id, p_prompt_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.forum_prompts
  SET discuss_click_count = (
    SELECT count(*) FROM public.forum_prompt_discuss_clicks WHERE prompt_id = p_prompt_id
  )
  WHERE id = p_prompt_id
  RETURNING * INTO v_prompt;

  IF v_prompt.spawned_thread_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'click_count', v_prompt.discuss_click_count,
      'threshold', v_prompt.discuss_threshold,
      'spawned_thread_id', v_prompt.spawned_thread_id,
      'spawned', false
    );
  END IF;

  IF v_prompt.discuss_click_count >= v_prompt.discuss_threshold THEN
    v_results := public.get_prompt_results(p_prompt_id);

    FOR v_headline IN SELECT * FROM jsonb_array_elements(v_prompt.source_headlines)
    LOOP
      v_sources := v_sources || E'\n- ' || coalesce(v_headline->>'title', '') ||
        ' (' || coalesce(v_headline->>'outlet', 'kilde') || ')';
    END LOOP;

    v_body := 'Dette er en fellesdiskusjon startet etter at nok brukere ønsket å debattere dagens spørsmål.' ||
      E'\n\n**Spørsmål:** ' || v_prompt.question ||
      E'\n\n**Stemmeresultat:** ' || v_results::text ||
      E'\n\n**Kilder:**' || v_sources;

    v_thread_id := public.create_forum_thread(
      NULL,
      v_prompt.question,
      v_body,
      NULL,
      '[]'::jsonb,
      true
    );

    UPDATE public.forum_prompts
    SET spawned_thread_id = v_thread_id
    WHERE id = p_prompt_id;

    RETURN jsonb_build_object(
      'click_count', v_prompt.discuss_click_count,
      'threshold', v_prompt.discuss_threshold,
      'spawned_thread_id', v_thread_id,
      'spawned', true
    );
  END IF;

  RETURN jsonb_build_object(
    'click_count', v_prompt.discuss_click_count,
    'threshold', v_prompt.discuss_threshold,
    'spawned_thread_id', NULL,
    'spawned', false
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_forum_thread(uuid, text, text, text, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.cast_prompt_vote(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_prompt_results(uuid) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_prompt_discuss_click(uuid, uuid) TO service_role;
-- <<< END 20260530120000_forum_enhancements.sql

-- >>> BEGIN 20260531120000_production_readiness.sql
-- Production readiness: AI webhook dedupe, Stortinget issue dates, forum prompt sak link

ALTER TABLE public.stortinget_issues
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_summary_requested_at timestamptz;

UPDATE public.stortinget_issues
SET first_seen_at = COALESCE(first_seen_at, last_synced_at, now()),
    last_updated_at = COALESCE(last_updated_at, last_synced_at, now())
WHERE first_seen_at IS NULL OR last_updated_at IS NULL;

ALTER TABLE public.forum_prompts
  ADD COLUMN IF NOT EXISTS stortinget_issue_id text REFERENCES public.stortinget_issues (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS stortinget_issues_pending_duration_idx
  ON public.stortinget_issues (status, first_seen_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS forum_prompts_stortinget_issue_idx
  ON public.forum_prompts (stortinget_issue_id)
  WHERE stortinget_issue_id IS NOT NULL;
-- <<< END 20260531120000_production_readiness.sql

-- >>> BEGIN 20260531140000_forum_prompts_dedupe.sql
-- Dedupe forum_prompts: archive duplicate active reels, add partial unique index

WITH ranked AS (
  SELECT
    id,
    lower(trim(question)) AS qnorm,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(question))
      ORDER BY created_at ASC, sort_order ASC
    ) AS rn
  FROM public.forum_prompts
  WHERE status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
    AND trim(question) <> ''
)
UPDATE public.forum_prompts fp
SET status = 'archived'
FROM ranked r
WHERE fp.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS forum_prompts_active_question_unique
  ON public.forum_prompts (lower(trim(question)))
  WHERE status = 'active'
    AND trim(question) <> '';
-- <<< END 20260531140000_forum_prompts_dedupe.sql

-- >>> BEGIN 20260601120000_forum_public_identity.sql
-- Forum public identity: first_name + last_name, no anonymous human posts

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- Backfill from name where possible (simple split on first space)
UPDATE public.users
SET
  first_name = COALESCE(
    first_name,
    NULLIF(split_part(trim(name), ' ', 1), '')
  ),
  last_name = COALESCE(
    last_name,
    NULLIF(
      trim(substring(trim(name) from position(' ' in trim(name)) + 1)),
      ''
    )
  )
WHERE name IS NOT NULL AND trim(name) <> '';

UPDATE public.users
SET name = trim(concat_ws(' ', first_name, last_name))
WHERE first_name IS NOT NULL
  AND last_name IS NOT NULL
  AND char_length(trim(first_name)) >= 2
  AND char_length(trim(last_name)) >= 2;

CREATE OR REPLACE FUNCTION public.user_has_forum_identity(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND char_length(trim(coalesce(u.first_name, ''))) >= 2
      AND char_length(trim(coalesce(u.last_name, ''))) >= 2
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_forum_identity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_forum_identity(uuid) TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_public_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_email text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found in auth.users';
  END IF;

  SELECT
    NULLIF(trim(raw_user_meta_data->>'first_name'), ''),
    NULLIF(trim(raw_user_meta_data->>'last_name'), ''),
    NULLIF(trim(raw_user_meta_data->>'full_name'), ''),
    email
  INTO v_first_name, v_last_name, v_full_name, v_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_first_name IS NULL AND v_last_name IS NULL AND v_full_name IS NOT NULL THEN
    v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
    v_last_name := NULLIF(trim(substring(v_full_name from position(' ' in v_full_name) + 1)), '');
  END IF;

  INSERT INTO public.users (id, first_name, last_name, name, email)
  VALUES (
    p_user_id,
    v_first_name,
    v_last_name,
    CASE
      WHEN v_first_name IS NOT NULL AND v_last_name IS NOT NULL
        AND char_length(v_first_name) >= 2 AND char_length(v_last_name) >= 2
      THEN trim(v_first_name || ' ' || v_last_name)
      ELSE v_full_name
    END,
    v_email
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, public.users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.users.last_name),
    name = CASE
      WHEN EXCLUDED.first_name IS NOT NULL AND EXCLUDED.last_name IS NOT NULL
        AND char_length(EXCLUDED.first_name) >= 2 AND char_length(EXCLUDED.last_name) >= 2
      THEN trim(EXCLUDED.first_name || ' ' || EXCLUDED.last_name)
      ELSE COALESCE(public.users.name, EXCLUDED.name)
    END,
    email = COALESCE(EXCLUDED.email, public.users.email);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_profile_names(
  p_user_id uuid,
  p_first_name text,
  p_last_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_first text;
  v_last text;
BEGIN
  v_first := trim(p_first_name);
  v_last := trim(p_last_name);

  IF char_length(v_first) < 2 OR char_length(v_last) < 2 THEN
    RAISE EXCEPTION 'Fornavn og etternavn må være minst 2 tegn';
  END IF;

  PERFORM public.ensure_public_user(p_user_id);

  UPDATE public.users
  SET
    first_name = v_first,
    last_name = v_last,
    name = trim(v_first || ' ' || v_last)
  WHERE id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_user_profile_names(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_profile_names(uuid, text, text) TO service_role;

ALTER TABLE public.forum_threads
  DROP CONSTRAINT IF EXISTS forum_threads_author_check;

ALTER TABLE public.forum_threads
  ADD CONSTRAINT forum_threads_author_check
  CHECK (is_system_thread = true OR author_user_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.create_forum_thread(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_stortinget_issue_id text DEFAULT NULL,
  p_context_items jsonb DEFAULT '[]'::jsonb,
  p_is_system_thread boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_thread_id uuid;
  v_title text;
  v_body text;
BEGIN
  IF NOT COALESCE(p_is_system_thread, false) THEN
    PERFORM public.ensure_public_user(p_user_id);
    IF NOT public.user_has_forum_identity(p_user_id) THEN
      RAISE EXCEPTION 'Complete your profile with first and last name before posting';
    END IF;
  END IF;

  v_title := btrim(p_title);
  v_body := btrim(p_body);

  IF char_length(v_title) < 3 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 3 and 200 characters';
  END IF;

  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  IF p_stortinget_issue_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.stortinget_issues WHERE id = p_stortinget_issue_id
  ) THEN
    RAISE EXCEPTION 'Unknown stortinget issue';
  END IF;

  INSERT INTO public.forum_threads (
    title, body, stortinget_issue_id, author_user_id, context_items, is_system_thread
  )
  VALUES (
    v_title, v_body, p_stortinget_issue_id, p_user_id,
    COALESCE(p_context_items, '[]'::jsonb),
    COALESCE(p_is_system_thread, false)
  )
  RETURNING id INTO v_thread_id;

  RETURN v_thread_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_forum_reply(
  p_user_id uuid,
  p_thread_id uuid,
  p_body text,
  p_parent_reply_id uuid DEFAULT NULL,
  p_is_official_response boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_reply_id uuid;
  v_body text;
  v_is_official boolean;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_forum_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before posting';
  END IF;

  IF p_parent_reply_id IS NOT NULL THEN
    RAISE EXCEPTION 'Nested replies are not supported';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.forum_threads WHERE id = p_thread_id) THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  v_body := btrim(p_body);

  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  v_is_official := COALESCE(p_is_official_response, false);

  IF v_is_official AND NOT EXISTS (
    SELECT 1 FROM public.politician_profiles WHERE user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Only verified politicians can post official responses';
  END IF;

  INSERT INTO public.forum_replies (thread_id, body, author_user_id, parent_reply_id, is_official_response)
  VALUES (p_thread_id, v_body, p_user_id, NULL, v_is_official)
  RETURNING id INTO v_reply_id;

  IF v_is_official THEN
    UPDATE public.forum_threads
    SET is_resolved = true
    WHERE id = p_thread_id;
  END IF;

  RETURN v_reply_id;
END;
$function$;

-- Hearing comments keyed by Stortinget hearing id (no hearings table required)
CREATE TABLE IF NOT EXISTS public.hearing_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stortinget_hearing_id text NOT NULL,
  body text NOT NULL,
  author_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hearing_comments
  ADD COLUMN IF NOT EXISTS stortinget_hearing_id text;

-- Legacy hearing_id uuid column: drop FK dependency on hearings if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hearing_comments' AND column_name = 'hearing_id'
  ) THEN
    ALTER TABLE public.hearing_comments DROP COLUMN IF EXISTS hearing_id;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS hearing_comments_stortinget_id_idx
  ON public.hearing_comments (stortinget_hearing_id, created_at);

ALTER TABLE public.hearing_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hearing_comments_select ON public.hearing_comments;
CREATE POLICY hearing_comments_select ON public.hearing_comments FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.create_hearing_comment(
  p_user_id uuid,
  p_stortinget_hearing_id text,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_comment_id uuid;
  v_body text;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_forum_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before posting';
  END IF;

  v_body := btrim(p_body);
  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  IF p_stortinget_hearing_id IS NULL OR char_length(trim(p_stortinget_hearing_id)) < 1 THEN
    RAISE EXCEPTION 'Invalid hearing id';
  END IF;

  INSERT INTO public.hearing_comments (stortinget_hearing_id, body, author_user_id)
  VALUES (trim(p_stortinget_hearing_id), v_body, p_user_id)
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_hearing_comment(uuid, text, text) TO service_role;

-- Forum reports (moderation queue)
CREATE TABLE IF NOT EXISTS public.forum_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('thread', 'reply')),
  target_id uuid NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_reports_status_idx ON public.forum_reports (status, created_at DESC);

ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forum_reports_insert ON public.forum_reports;
CREATE POLICY forum_reports_insert ON public.forum_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

DROP POLICY IF EXISTS forum_reports_select_own ON public.forum_reports;
CREATE POLICY forum_reports_select_own ON public.forum_reports
  FOR SELECT USING (auth.uid() = reporter_user_id);
-- <<< END 20260601120000_forum_public_identity.sql

-- >>> BEGIN 20260602120000_forum_reports_enhance.sql
-- Forum reports: categories, admin notes, one report per user per target

ALTER TABLE public.forum_reports
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.forum_reports
  DROP CONSTRAINT IF EXISTS forum_reports_category_check;

ALTER TABLE public.forum_reports
  ADD CONSTRAINT forum_reports_category_check
  CHECK (
    category IS NULL
    OR category IN ('spam', 'harassment', 'misinformation', 'other')
  );

-- Backfill null category as other for existing rows (optional)
UPDATE public.forum_reports SET category = 'other' WHERE category IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS forum_reports_reporter_target_uidx
  ON public.forum_reports (reporter_user_id, target_type, target_id);
-- <<< END 20260602120000_forum_reports_enhance.sql

-- >>> BEGIN 20260602130000_forum_trusted_sources.sql
-- Approved news domains for forum reels (n8n + admin)
CREATE TABLE IF NOT EXISTS public.forum_trusted_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  outlet_label text NOT NULL,
  status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('approved', 'pending', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users (id)
);

CREATE INDEX IF NOT EXISTS forum_trusted_sources_status_idx
  ON public.forum_trusted_sources (status);

ALTER TABLE public.forum_trusted_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forum_trusted_sources_select ON public.forum_trusted_sources;
CREATE POLICY forum_trusted_sources_select ON public.forum_trusted_sources
  FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.forum_trusted_sources (domain, outlet_label, status, approved_at)
VALUES
  ('vg.no', 'VG', 'approved', now()),
  ('nrk.no', 'NRK', 'approved', now()),
  ('aftenposten.no', 'Aftenposten', 'approved', now()),
  ('dagbladet.no', 'Dagbladet', 'approved', now()),
  ('stortinget.no', 'Stortinget', 'approved', now()),
  ('folketsstemme.no', 'Folkets Stemme', 'approved', now()),
  ('folkets-stemme.no', 'Folkets Stemme', 'approved', now())
ON CONFLICT (domain) DO NOTHING;
-- <<< END 20260602130000_forum_trusted_sources.sql

-- >>> BEGIN 20260603120000_forum_prompt_moderation_feedback.sql
-- Moderation feedback for forum prompts: learns from admin + AI decisions
CREATE TABLE IF NOT EXISTS public.forum_prompt_moderation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES public.forum_prompts (id) ON DELETE SET NULL,
  question text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('approved', 'rejected')),
  reason text,
  source text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'ai', 'auto')),
  topic_tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_prompt_moderation_feedback_verdict_idx
  ON public.forum_prompt_moderation_feedback (verdict, created_at DESC);

CREATE INDEX IF NOT EXISTS forum_prompt_moderation_feedback_question_idx
  ON public.forum_prompt_moderation_feedback (lower(trim(question)));

ALTER TABLE public.forum_prompt_moderation_feedback ENABLE ROW LEVEL SECURITY;

-- Service role / n8n only (no public read)
DROP POLICY IF EXISTS forum_prompt_moderation_feedback_service ON public.forum_prompt_moderation_feedback;
CREATE POLICY forum_prompt_moderation_feedback_service ON public.forum_prompt_moderation_feedback
  FOR ALL USING (false);

-- Log admin status changes as learning examples
CREATE OR REPLACE FUNCTION public.log_forum_prompt_moderation_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'active' AND OLD.status IN ('draft', 'archived') THEN
      INSERT INTO public.forum_prompt_moderation_feedback (prompt_id, question, verdict, reason, source, topic_tags)
      VALUES (NEW.id, NEW.question, 'approved', 'Aktivert av admin', 'admin', COALESCE(NEW.topic_tags, '{}'));
    ELSIF NEW.status = 'archived' AND OLD.status IN ('draft', 'active') THEN
      INSERT INTO public.forum_prompt_moderation_feedback (prompt_id, question, verdict, reason, source, topic_tags)
      VALUES (NEW.id, NEW.question, 'rejected', 'Arkivert av admin', 'admin', COALESCE(NEW.topic_tags, '{}'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forum_prompts_moderation_feedback_trg ON public.forum_prompts;
CREATE TRIGGER forum_prompts_moderation_feedback_trg
  AFTER UPDATE OF status ON public.forum_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_forum_prompt_moderation_feedback();

-- Seed from existing prompts (one-time bootstrap)
INSERT INTO public.forum_prompt_moderation_feedback (question, verdict, reason, source, topic_tags, created_at)
SELECT fp.question, 'approved', 'Historisk aktiv prompt', 'auto', COALESCE(fp.topic_tags, '{}'), fp.created_at
FROM public.forum_prompts fp
WHERE fp.status = 'active'
  AND trim(fp.question) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.forum_prompt_moderation_feedback f
    WHERE lower(trim(f.question)) = lower(trim(fp.question)) AND f.verdict = 'approved'
  )
ORDER BY fp.created_at DESC
LIMIT 40;

INSERT INTO public.forum_prompt_moderation_feedback (question, verdict, reason, source, topic_tags, created_at)
SELECT fp.question, 'rejected', 'Historisk arkivert prompt', 'auto', COALESCE(fp.topic_tags, '{}'), fp.created_at
FROM public.forum_prompts fp
WHERE fp.status = 'archived'
  AND trim(fp.question) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.forum_prompt_moderation_feedback f
    WHERE lower(trim(f.question)) = lower(trim(fp.question)) AND f.verdict = 'rejected'
  )
ORDER BY fp.created_at DESC
LIMIT 40;
-- <<< END 20260603120000_forum_prompt_moderation_feedback.sql

-- >>> BEGIN 20260603140000_forum_research_clusters.sql
-- Forum Reels v7: two-step pipeline (discovery → deep synthesis)
-- Flow 1 stores interesting story clusters; flow 2 deep-researches and creates prompts.

CREATE TABLE IF NOT EXISTS public.forum_research_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_cluster_key text,
  title text NOT NULL,
  discovery_rationale text,
  topic_tags text[] NOT NULL DEFAULT '{}',
  politics_score int NOT NULL DEFAULT 0,
  source_count int NOT NULL DEFAULT 0,
  span_days numeric,
  stortinget_issue_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'failed')),
  deep_research_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.forum_research_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.forum_research_clusters (id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  outlet text,
  published_at timestamptz,
  description text,
  image_url text,
  video_url text,
  article_text text,
  article_fetch_status text,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cluster_id, url)
);

CREATE INDEX IF NOT EXISTS forum_research_clusters_status_idx
  ON public.forum_research_clusters (status, politics_score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS forum_research_clusters_title_recent_idx
  ON public.forum_research_clusters (lower(trim(title)), created_at DESC);

CREATE INDEX IF NOT EXISTS forum_research_articles_cluster_idx
  ON public.forum_research_articles (cluster_id, sort_order);

ALTER TABLE public.forum_research_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_research_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forum_research_clusters_select ON public.forum_research_clusters;
CREATE POLICY forum_research_clusters_select ON public.forum_research_clusters
  FOR SELECT USING (true);

DROP POLICY IF EXISTS forum_research_articles_select ON public.forum_research_articles;
CREATE POLICY forum_research_articles_select ON public.forum_research_articles
  FOR SELECT USING (true);

COMMENT ON TABLE public.forum_research_clusters IS 'Story clusters queued by forum-research-discovery for deep synthesis';
COMMENT ON TABLE public.forum_research_articles IS 'Source articles per research cluster';
-- <<< END 20260603140000_forum_research_clusters.sql

-- >>> BEGIN 20260604120000_forum_research_two_step.sql
-- Forum Reels v9: two-step human review (clusters → synthesis → draft prompts)

-- Extend cluster status lifecycle for editor approval before synthesis
ALTER TABLE public.forum_research_clusters
  DROP CONSTRAINT IF EXISTS forum_research_clusters_status_check;

-- Normalize all known statuses (v7 + v10.2 ahead-of-migration) before re-adding constraint
UPDATE public.forum_research_clusters
SET status = CASE status
  WHEN 'pending' THEN 'pending_review'
  WHEN 'accepted' THEN 'approved'
  WHEN 'draft' THEN 'completed'
  WHEN 'finished' THEN 'completed'
  ELSE status
END,
updated_at = now()
WHERE status IN ('pending', 'accepted', 'draft', 'finished');

-- Fallback for any unexpected legacy value
UPDATE public.forum_research_clusters
SET status = 'pending_review', updated_at = now()
WHERE status NOT IN (
  'pending_review',
  'approved',
  'rejected',
  'processing',
  'completed',
  'failed'
);

ALTER TABLE public.forum_research_clusters
  ALTER COLUMN status SET DEFAULT 'pending_review';

ALTER TABLE public.forum_research_clusters
  ADD CONSTRAINT forum_research_clusters_status_check
  CHECK (
    status IN (
      'pending_review',
      'approved',
      'rejected',
      'processing',
      'completed',
      'failed'
    )
  );

COMMENT ON COLUMN public.forum_research_clusters.status IS
  'pending_review=awaiting editor; approved=queued; processing=synthesis running; completed=prompt drafted; rejected/failed=terminal';

-- Optional trace from generated prompt back to cluster (n8n may set on insert later)
ALTER TABLE public.forum_prompts
  ADD COLUMN IF NOT EXISTS research_cluster_id uuid
  REFERENCES public.forum_research_clusters (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS forum_prompts_research_cluster_idx
  ON public.forum_prompts (research_cluster_id)
  WHERE research_cluster_id IS NOT NULL;
-- <<< END 20260604120000_forum_research_two_step.sql

-- >>> BEGIN 20260606120000_forum_research_pipeline_queue.sql
-- Forum Reels v10.2: DB-backed synthesis queue (no webhook on approve)
-- Status lifecycle: pending → accepted → processing → draft → finished | rejected | failed

ALTER TABLE public.forum_research_clusters
  DROP CONSTRAINT IF EXISTS forum_research_clusters_status_check;

-- Recover stuck synthesis jobs
UPDATE public.forum_research_clusters
SET status = 'accepted', updated_at = now()
WHERE status = 'processing'
  AND deep_research_json IS NULL
  AND updated_at < now() - interval '90 minutes';

UPDATE public.forum_research_clusters
SET status = CASE status
  WHEN 'pending_review' THEN 'pending'
  WHEN 'approved' THEN 'accepted'
  WHEN 'completed' THEN 'draft'
  ELSE status
END,
updated_at = now()
WHERE status IN ('pending_review', 'approved', 'completed');

-- Fallback before v10.2 constraint (e.g. partial v9 apply or manual edits)
UPDATE public.forum_research_clusters
SET status = 'pending', updated_at = now()
WHERE status NOT IN (
  'pending',
  'accepted',
  'processing',
  'draft',
  'finished',
  'rejected',
  'failed'
);

ALTER TABLE public.forum_research_clusters
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.forum_research_clusters
  ADD CONSTRAINT forum_research_clusters_status_check
  CHECK (
    status IN (
      'pending',
      'accepted',
      'processing',
      'draft',
      'finished',
      'rejected',
      'failed'
    )
  );

COMMENT ON COLUMN public.forum_research_clusters.status IS
  'pending=scout queue; accepted=synthesis queue; processing=n8n worker; draft=prompt created; finished=published; rejected/failed=terminal';

-- Drop unused cluster columns (never populated by v10 scout)
ALTER TABLE public.forum_research_clusters
  DROP COLUMN IF EXISTS span_days,
  DROP COLUMN IF EXISTS stortinget_issue_id;

-- Drop unused article enrichment columns (v10 scout stores title/url/outlet/description only)
ALTER TABLE public.forum_research_articles
  DROP COLUMN IF EXISTS article_text,
  DROP COLUMN IF EXISTS article_fetch_status,
  DROP COLUMN IF EXISTS image_url,
  DROP COLUMN IF EXISTS video_url;

-- Fast dequeue for n8n schedule worker
CREATE INDEX IF NOT EXISTS forum_research_clusters_accepted_queue_idx
  ON public.forum_research_clusters (politics_score DESC, created_at ASC)
  WHERE status = 'accepted';
-- <<< END 20260606120000_forum_research_pipeline_queue.sql

-- >>> BEGIN 20260606220000_forum_research_reapply_v10_statuses.sql
-- Re-apply v10.2 cluster statuses after accidental v9 rollback (20260606201733)

ALTER TABLE public.forum_research_clusters
  DROP CONSTRAINT IF EXISTS forum_research_clusters_status_check;

UPDATE public.forum_research_clusters
SET status = 'accepted', updated_at = now()
WHERE status = 'processing'
  AND deep_research_json IS NULL
  AND updated_at < now() - interval '90 minutes';

UPDATE public.forum_research_clusters
SET status = CASE status
  WHEN 'pending_review' THEN 'pending'
  WHEN 'approved' THEN 'accepted'
  WHEN 'completed' THEN 'draft'
  ELSE status
END,
updated_at = now()
WHERE status IN ('pending_review', 'approved', 'completed');

UPDATE public.forum_research_clusters
SET status = 'pending', updated_at = now()
WHERE status NOT IN (
  'pending',
  'accepted',
  'processing',
  'draft',
  'finished',
  'rejected',
  'failed'
);

ALTER TABLE public.forum_research_clusters
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.forum_research_clusters
  ADD CONSTRAINT forum_research_clusters_status_check
  CHECK (
    status IN (
      'pending',
      'accepted',
      'processing',
      'draft',
      'finished',
      'rejected',
      'failed'
    )
  );

CREATE INDEX IF NOT EXISTS forum_research_clusters_accepted_queue_idx
  ON public.forum_research_clusters (politics_score DESC, created_at ASC)
  WHERE status = 'accepted';
-- <<< END 20260606220000_forum_research_reapply_v10_statuses.sql

-- >>> BEGIN 20260607120000_forum_scout_v11_source_payload.sql
-- Forum Reels scout v11: rich article metadata + scout debug metadata on clusters

ALTER TABLE public.forum_research_articles
  ADD COLUMN IF NOT EXISTS source_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.forum_research_articles.source_payload IS
  'Scout enrichment: excerpt, fetch_status, image_url, word_count, published_at_rss';

ALTER TABLE public.forum_research_clusters
  ADD COLUMN IF NOT EXISTS scout_metadata jsonb DEFAULT NULL;

COMMENT ON COLUMN public.forum_research_clusters.scout_metadata IS
  'Scout v11: outlet_count, cluster_score, ingest stats, debatten_used';

COMMENT ON COLUMN public.forum_research_clusters.politics_score IS
  'Deterministic politics priority from scout ingest (higher = dequeue first)';
-- <<< END 20260607120000_forum_scout_v11_source_payload.sql

-- >>> BEGIN 20260608120000_issue_ai_summaries_v2.sql
-- AI summaries v2: narrative, who/how affected, dynamic topic cards, labels

ALTER TABLE public.issue_ai_summaries
  ADD COLUMN IF NOT EXISTS narrative text,
  ADD COLUMN IF NOT EXISTS who_affected text,
  ADD COLUMN IF NOT EXISTS how_affected text,
  ADD COLUMN IF NOT EXISTS topic_cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS labels text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.stortinget_issues
  ADD COLUMN IF NOT EXISTS ai_labels text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS issue_ai_summaries_labels_gin
  ON public.issue_ai_summaries USING gin (labels);

CREATE INDEX IF NOT EXISTS stortinget_issues_ai_labels_gin
  ON public.stortinget_issues USING gin (ai_labels);

-- Backfill v2 from legacy hva/hvem/kostnad where possible
UPDATE public.issue_ai_summaries
SET
  narrative = COALESCE(NULLIF(trim(narrative), ''), trim(hva)),
  who_affected = COALESCE(NULLIF(trim(who_affected), ''), trim(hvem)),
  how_affected = COALESCE(
    NULLIF(trim(how_affected), ''),
    CASE WHEN trim(hvem) <> '' THEN 'Se hvem som berøres ovenfor.' ELSE NULL END
  ),
  topic_cards = CASE
    WHEN topic_cards IS NULL OR topic_cards = '[]'::jsonb THEN
      CASE
        WHEN trim(kostnad) <> '' THEN jsonb_build_array(jsonb_build_object('title', 'Økonomi', 'body', trim(kostnad)))
        ELSE '[]'::jsonb
      END
    ELSE topic_cards
  END
WHERE trim(COALESCE(hva, '')) <> '';

UPDATE public.stortinget_issues i
SET ai_labels = s.labels
FROM public.issue_ai_summaries s
WHERE s.stortinget_issue_id = i.id
  AND cardinality(s.labels) > 0
  AND (i.ai_labels IS NULL OR i.ai_labels = '{}');

COMMENT ON COLUMN public.issue_ai_summaries.labels IS
  '2–5 AI-generated topic labels for search and notifications';
COMMENT ON COLUMN public.issue_ai_summaries.topic_cards IS
  '0–3 dynamic topic cards chosen by AI (title + body)';
COMMENT ON COLUMN public.stortinget_issues.ai_labels IS
  'Denormalized copy of issue_ai_summaries.labels for fast Utforsk filter';

-- Label notification subscriptions (AI emne-tags)
CREATE TABLE IF NOT EXISTS public.notification_label_subscriptions (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, label)
);

ALTER TABLE public.notification_label_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_label_subscriptions_select_own ON public.notification_label_subscriptions;
CREATE POLICY notification_label_subscriptions_select_own
  ON public.notification_label_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_label_subscriptions_insert_own ON public.notification_label_subscriptions;
CREATE POLICY notification_label_subscriptions_insert_own
  ON public.notification_label_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_label_subscriptions_delete_own ON public.notification_label_subscriptions;
CREATE POLICY notification_label_subscriptions_delete_own
  ON public.notification_label_subscriptions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
-- <<< END 20260608120000_issue_ai_summaries_v2.sql

-- >>> BEGIN 20260614130000_forum_profiles_points_ai_sources.sql
-- Forum moderation, activity points, public profile fields, and richer AI summary sources

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS party_preference text,
  ADD COLUMN IF NOT EXISTS profile_is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_party_preference boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_points boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.forum_threads
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('approved', 'rejected', 'hidden')),
  ADD COLUMN IF NOT EXISTS moderation_category text,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz;

ALTER TABLE public.forum_replies
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('approved', 'rejected', 'hidden')),
  ADD COLUMN IF NOT EXISTS moderation_category text,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz;

CREATE INDEX IF NOT EXISTS forum_threads_moderation_status_idx
  ON public.forum_threads (moderation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS forum_replies_moderation_status_idx
  ON public.forum_replies (moderation_status, created_at DESC);

DROP POLICY IF EXISTS forum_threads_select ON public.forum_threads;
CREATE POLICY forum_threads_select
  ON public.forum_threads
  FOR SELECT TO anon, authenticated
  USING (moderation_status = 'approved');

DROP POLICY IF EXISTS forum_replies_select ON public.forum_replies;
CREATE POLICY forum_replies_select
  ON public.forum_replies
  FOR SELECT TO anon, authenticated
  USING (moderation_status = 'approved');

ALTER TABLE public.stortinget_issues
  ADD COLUMN IF NOT EXISTS ai_summary_source_context text,
  ADD COLUMN IF NOT EXISTS ai_summary_source_json jsonb,
  ADD COLUMN IF NOT EXISTS ai_summary_source_hash text,
  ADD COLUMN IF NOT EXISTS ai_summary_source_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.stortinget_issue_documents (
  issue_id text NOT NULL REFERENCES public.stortinget_issues (id) ON DELETE CASCADE,
  document_id text NOT NULL,
  title text,
  document_type text,
  text_excerpt text,
  source_url text,
  content_hash text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, document_id)
);

ALTER TABLE public.stortinget_issue_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stortinget_issue_documents_select_all ON public.stortinget_issue_documents;
CREATE POLICY stortinget_issue_documents_select_all
  ON public.stortinget_issue_documents
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.user_points_balances (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  ref_type text NOT NULL,
  ref_id uuid,
  ref_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reason, ref_key)
);

CREATE INDEX IF NOT EXISTS user_points_ledger_user_created_idx
  ON public.user_points_ledger (user_id, created_at DESC);

ALTER TABLE public.user_points_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_points_balances_select ON public.user_points_balances;
CREATE POLICY user_points_balances_select
  ON public.user_points_balances
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS user_points_ledger_select_own ON public.user_points_ledger;
CREATE POLICY user_points_ledger_select_own
  ON public.user_points_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.award_user_points(
  p_user_id uuid,
  p_delta integer,
  p_reason text,
  p_ref_type text,
  p_ref_key text,
  p_ref_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_delta = 0 OR p_ref_key IS NULL OR btrim(p_ref_key) = '' THEN
    RETURN false;
  END IF;

  WITH inserted AS (
    INSERT INTO public.user_points_ledger (user_id, delta, reason, ref_type, ref_key, ref_id)
    VALUES (p_user_id, p_delta, p_reason, p_ref_type, p_ref_key, p_ref_id)
    ON CONFLICT (user_id, reason, ref_key) DO NOTHING
    RETURNING user_id, delta
  ),
  upserted AS (
    INSERT INTO public.user_points_balances (user_id, points, updated_at)
    SELECT user_id, delta, now()
    FROM inserted
    ON CONFLICT (user_id) DO UPDATE SET
      points = public.user_points_balances.points + EXCLUDED.points,
      updated_at = now()
    RETURNING true
  )
  SELECT EXISTS (SELECT 1 FROM upserted) INTO v_inserted;

  RETURN v_inserted;
END;
$function$;

REVOKE ALL ON FUNCTION public.award_user_points(uuid, integer, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_user_points(uuid, integer, text, text, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.forum_moderation_check(p_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_text text := lower(coalesce(p_text, ''));
BEGIN
  IF btrim(v_text) = '' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'other', 'reason', 'Innholdet kan ikke være tomt');
  END IF;

  IF v_text ~ '(nazi|heil hitler|white power|jødesvin|jødehat|jævla[[:space:]]+(neger|jævel)|drep[[:space:]]+(alle|dem|innvandrere))' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'hate', 'reason', 'Innlegget bryter retningslinjene for respektfull debatt');
  END IF;

  IF v_text ~ '((rase|religion|legning|funksjonshemmede)[[:space:]]+(burde|skal)[[:space:]]+(ut|fjernes|nektes)|(alle|ingen)[[:space:]]+(muslimer|jøder|homofile|transpersoner|romfolk)[[:space:]]+(er|bør|skal)|(send|kast)[[:space:]]+(dem|alle)[[:space:]]+ut)' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'discrimination', 'reason', 'Diskriminerende generaliseringer er ikke tillatt');
  END IF;

  IF v_text ~ '(porno|pornhub|xnxx|xvideos|onlyfans|sex[[:space:]]*video|erotisk[[:space:]]+film)' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'sexual', 'reason', 'Eksplisitt eller upassende innhold er ikke tillatt');
  END IF;

  IF v_text ~ '((drep|skyt|henrett)[[:space:]]+(ham|henne|dem|alle)|bank[[:space:]]+opp[[:space:]]+(ham|henne|dem|alle)|(bombe|terror|massakre)[[:space:]]+(stortinget|regjeringen|politikere|dem))' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'violence', 'reason', 'Oppfordringer til vold er ikke tillatt');
  END IF;

  IF v_text ~ '(kjøp[[:space:]]+nå|gratis[[:space:]]+penger|crypto[[:space:]]+giveaway)' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'spam', 'reason', 'Innlegget ser ut som spam');
  END IF;

  RETURN jsonb_build_object('approved', true, 'category', null, 'reason', null);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_forum_thread(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_stortinget_issue_id text DEFAULT NULL,
  p_context_items jsonb DEFAULT '[]'::jsonb,
  p_is_system_thread boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_thread_id uuid;
  v_title text;
  v_body text;
  v_moderation jsonb;
BEGIN
  IF NOT COALESCE(p_is_system_thread, false) THEN
    PERFORM public.ensure_public_user(p_user_id);
    IF NOT public.user_has_forum_identity(p_user_id) THEN
      RAISE EXCEPTION 'Complete your profile with first and last name before posting';
    END IF;
  END IF;

  v_title := btrim(p_title);
  v_body := btrim(p_body);

  IF char_length(v_title) < 3 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 3 and 200 characters';
  END IF;

  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  v_moderation := public.forum_moderation_check(v_title || E'\n' || v_body);
  IF NOT COALESCE((v_moderation->>'approved')::boolean, false) THEN
    RAISE EXCEPTION 'MODERATION_REJECTED:%', v_moderation->>'reason';
  END IF;

  IF p_stortinget_issue_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.stortinget_issues WHERE id = p_stortinget_issue_id
  ) THEN
    RAISE EXCEPTION 'Unknown stortinget issue';
  END IF;

  INSERT INTO public.forum_threads (
    title, body, stortinget_issue_id, author_user_id, context_items, is_system_thread,
    moderation_status, moderation_category, moderation_reason, moderated_at
  )
  VALUES (
    v_title, v_body, p_stortinget_issue_id, p_user_id,
    COALESCE(p_context_items, '[]'::jsonb),
    COALESCE(p_is_system_thread, false),
    'approved', v_moderation->>'category', v_moderation->>'reason', now()
  )
  RETURNING id INTO v_thread_id;

  RETURN v_thread_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_forum_reply(
  p_user_id uuid,
  p_thread_id uuid,
  p_body text,
  p_parent_reply_id uuid DEFAULT NULL,
  p_is_official_response boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_reply_id uuid;
  v_body text;
  v_is_official boolean;
  v_moderation jsonb;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_forum_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before posting';
  END IF;

  IF p_parent_reply_id IS NOT NULL THEN
    RAISE EXCEPTION 'Nested replies are not supported';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.forum_threads
    WHERE id = p_thread_id AND moderation_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  v_body := btrim(p_body);

  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  v_moderation := public.forum_moderation_check(v_body);
  IF NOT COALESCE((v_moderation->>'approved')::boolean, false) THEN
    RAISE EXCEPTION 'MODERATION_REJECTED:%', v_moderation->>'reason';
  END IF;

  v_is_official := COALESCE(p_is_official_response, false);

  IF v_is_official AND NOT EXISTS (
    SELECT 1 FROM public.politician_profiles WHERE user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Only verified politicians can post official responses';
  END IF;

  INSERT INTO public.forum_replies (
    thread_id, body, author_user_id, parent_reply_id, is_official_response,
    moderation_status, moderation_category, moderation_reason, moderated_at
  )
  VALUES (
    p_thread_id, v_body, p_user_id, NULL, v_is_official,
    'approved', v_moderation->>'category', v_moderation->>'reason', now()
  )
  RETURNING id INTO v_reply_id;

  IF v_is_official THEN
    UPDATE public.forum_threads
    SET is_resolved = true
    WHERE id = p_thread_id;
  END IF;

  RETURN v_reply_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.award_points_for_forum_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.author_user_id IS NOT NULL
    AND NEW.is_system_thread = false
    AND NEW.moderation_status = 'approved' THEN
    PERFORM public.award_user_points(
      NEW.author_user_id, 10, 'forum_thread_created', 'forum_thread', 'thread:' || NEW.id::text, NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_points_for_forum_thread ON public.forum_threads;
CREATE TRIGGER trg_award_points_for_forum_thread
AFTER INSERT ON public.forum_threads
FOR EACH ROW
EXECUTE FUNCTION public.award_points_for_forum_thread();

CREATE OR REPLACE FUNCTION public.award_points_for_forum_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.author_user_id IS NOT NULL AND NEW.moderation_status = 'approved' THEN
    PERFORM public.award_user_points(
      NEW.author_user_id, 5, 'forum_reply_created', 'forum_reply', 'reply:' || NEW.id::text, NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_points_for_forum_reply ON public.forum_replies;
CREATE TRIGGER trg_award_points_for_forum_reply
AFTER INSERT ON public.forum_replies
FOR EACH ROW
EXECUTE FUNCTION public.award_points_for_forum_reply();

CREATE OR REPLACE FUNCTION public.award_points_for_forum_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_author_id uuid;
BEGIN
  PERFORM public.award_user_points(
    NEW.user_id, 1, 'forum_like_given', 'forum_like', 'like-given:' || NEW.user_id::text || ':' || NEW.target_type || ':' || NEW.target_id::text, NEW.target_id
  );

  IF NEW.target_type = 'thread' THEN
    SELECT author_user_id INTO v_author_id
    FROM public.forum_threads
    WHERE id = NEW.target_id AND moderation_status = 'approved';
  ELSE
    SELECT author_user_id INTO v_author_id
    FROM public.forum_replies
    WHERE id = NEW.target_id AND moderation_status = 'approved';
  END IF;

  IF v_author_id IS NOT NULL AND v_author_id <> NEW.user_id THEN
    PERFORM public.award_user_points(
      v_author_id, 2, 'forum_like_received', NEW.target_type,
      'like-received:' || NEW.user_id::text || ':' || NEW.target_type || ':' || NEW.target_id::text,
      NEW.target_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_points_for_forum_like ON public.forum_likes;
CREATE TRIGGER trg_award_points_for_forum_like
AFTER INSERT ON public.forum_likes
FOR EACH ROW
EXECUTE FUNCTION public.award_points_for_forum_like();

CREATE OR REPLACE FUNCTION public.award_points_for_vote_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.ensure_public_user(NEW.user_id);
  PERFORM public.award_user_points(
    NEW.user_id, 3, 'vote_cast', 'stortinget_issue',
    'vote:' || NEW.user_id::text || ':' || NEW.stortinget_issue_id,
    NULL
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_points_for_vote_receipt ON public.user_vote_receipts;
CREATE TRIGGER trg_award_points_for_vote_receipt
AFTER INSERT ON public.user_vote_receipts
FOR EACH ROW
EXECUTE FUNCTION public.award_points_for_vote_receipt();
-- <<< END 20260614130000_forum_profiles_points_ai_sources.sql

-- >>> BEGIN 20260614160000_harden_forum_points_moderation.sql
-- Harden forum moderation/points functions and remove duplicate public forum read policies.

CREATE OR REPLACE FUNCTION public.forum_moderation_check(p_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_text text := lower(coalesce(p_text, ''));
BEGIN
  IF btrim(v_text) = '' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'other', 'reason', 'Innholdet kan ikke være tomt');
  END IF;

  IF v_text ~ '(nazi|heil hitler|white power|jødesvin|jødehat|jævla[[:space:]]+(neger|jævel)|drep[[:space:]]+(alle|dem|innvandrere))' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'hate', 'reason', 'Innlegget bryter retningslinjene for respektfull debatt');
  END IF;

  IF v_text ~ '((rase|religion|legning|funksjonshemmede)[[:space:]]+(burde|skal)[[:space:]]+(ut|fjernes|nektes)|(alle|ingen)[[:space:]]+(muslimer|jøder|homofile|transpersoner|romfolk)[[:space:]]+(er|bør|skal)|(send|kast)[[:space:]]+(dem|alle)[[:space:]]+ut)' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'discrimination', 'reason', 'Diskriminerende generaliseringer er ikke tillatt');
  END IF;

  IF v_text ~ '(porno|pornhub|xnxx|xvideos|onlyfans|sex[[:space:]]*video|erotisk[[:space:]]+film)' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'sexual', 'reason', 'Eksplisitt eller upassende innhold er ikke tillatt');
  END IF;

  IF v_text ~ '((drep|skyt|henrett)[[:space:]]+(ham|henne|dem|alle)|bank[[:space:]]+opp[[:space:]]+(ham|henne|dem|alle)|(bombe|terror|massakre)[[:space:]]+(stortinget|regjeringen|politikere|dem))' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'violence', 'reason', 'Oppfordringer til vold er ikke tillatt');
  END IF;

  IF v_text ~ '(kjøp[[:space:]]+nå|gratis[[:space:]]+penger|crypto[[:space:]]+giveaway)' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'spam', 'reason', 'Innlegget ser ut som spam');
  END IF;

  RETURN jsonb_build_object('approved', true, 'category', null, 'reason', null);
END;
$function$;

REVOKE ALL ON FUNCTION public.forum_moderation_check(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.forum_moderation_check(text) TO service_role;

REVOKE ALL ON FUNCTION public.award_user_points(uuid, integer, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_points_for_forum_thread() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_points_for_forum_reply() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_points_for_forum_like() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_points_for_vote_receipt() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.award_user_points(uuid, integer, text, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.create_forum_thread(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_forum_thread(uuid, text, text, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_forum_reply(uuid, uuid, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.toggle_forum_like(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_forum_thread(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_forum_thread(uuid, text, text, text, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_forum_reply(uuid, uuid, text, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.toggle_forum_like(uuid, text, uuid) TO service_role;

DROP POLICY IF EXISTS forum_threads_select_all ON public.forum_threads;
DROP POLICY IF EXISTS forum_replies_select_all ON public.forum_replies;
-- <<< END 20260614160000_harden_forum_points_moderation.sql

-- >>> BEGIN 20260614170000_public_user_display_grants.sql
-- Allow public forum/profile reads to resolve author display names without exposing email.

DROP POLICY IF EXISTS users_select_public_display ON public.users;
CREATE POLICY users_select_public_display
  ON public.users
  FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT (id, first_name, last_name, name) ON public.users TO anon, authenticated;
-- <<< END 20260614170000_public_user_display_grants.sql

-- >>> BEGIN 20260616120000_stortinget_issue_sak_kind.sql
-- Debatt- og stemmevennlige saker: metadata fra Stortingets API for filtrering og visning
ALTER TABLE public.stortinget_issues
  ADD COLUMN IF NOT EXISTS dokumentgruppe smallint,
  ADD COLUMN IF NOT EXISTS henvisning text,
  ADD COLUMN IF NOT EXISTS sak_kind text;

ALTER TABLE public.stortinget_issues
  DROP CONSTRAINT IF EXISTS stortinget_issues_sak_kind_check;

ALTER TABLE public.stortinget_issues
  ADD CONSTRAINT stortinget_issues_sak_kind_check
  CHECK (sak_kind IS NULL OR sak_kind IN ('lovforslag', 'representantforslag'));

CREATE INDEX IF NOT EXISTS idx_stortinget_issues_sak_kind
  ON public.stortinget_issues (sak_kind)
  WHERE sak_kind IS NOT NULL;

COMMENT ON COLUMN public.stortinget_issues.sak_kind IS 'Debatt- og stemmevennlig sakstype: lovforslag eller representantforslag';
COMMENT ON COLUMN public.stortinget_issues.dokumentgruppe IS 'Stortinget dokumentgruppe fra /eksport/saker';
COMMENT ON COLUMN public.stortinget_issues.henvisning IS 'Stortinget henvisning (f.eks. Prop. 103 L eller Dokument 8:302)';
-- <<< END 20260616120000_stortinget_issue_sak_kind.sql

-- >>> BEGIN 20260617120000_sak_documents_rag.sql
-- Sak documents: cached HTML/text + RAG chunks (pgvector)

ALTER TABLE public.stortinget_issue_documents
  ADD COLUMN IF NOT EXISTS content_html text,
  ADD COLUMN IF NOT EXISTS content_full_text text,
  ADD COLUMN IF NOT EXISTS mime_type text DEFAULT 'text/html',
  ADD COLUMN IF NOT EXISTS ingest_status text NOT NULL DEFAULT 'pending';

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id text NOT NULL REFERENCES public.stortinget_issues (id) ON DELETE CASCADE,
  document_id text NOT NULL,
  chunk_index int NOT NULL,
  content text NOT NULL,
  embedding vector(768),
  embedding_status text NOT NULL DEFAULT 'pending',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issue_id, document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS document_chunks_issue_id_idx
  ON public.document_chunks (issue_id);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_pending_idx
  ON public.document_chunks (embedding_status)
  WHERE embedding_status = 'pending';

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_chunks_select_all ON public.document_chunks;
CREATE POLICY document_chunks_select_all
  ON public.document_chunks
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.match_issue_document_chunks(
  p_issue_id text,
  p_query_embedding vector(768),
  p_match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  document_id text,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> p_query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE dc.issue_id = p_issue_id
    AND dc.embedding IS NOT NULL
    AND dc.embedding_status = 'ready'
  ORDER BY dc.embedding <=> p_query_embedding
  LIMIT GREATEST(p_match_count, 1);
$$;
-- <<< END 20260617120000_sak_documents_rag.sql

-- >>> BEGIN 20260618120000_sak_voting_status.sql
-- Persist ferdigbehandlet + voting deadline; block votes on closed saker

ALTER TABLE public.stortinget_issues
  ADD COLUMN IF NOT EXISTS ferdigbehandlet boolean,
  ADD COLUMN IF NOT EXISTS voting_closes_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_stortinget_issues_pending_sync
  ON public.stortinget_issues (status, last_synced_at)
  WHERE status = 'pending';

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

  IF EXISTS (
    SELECT 1
    FROM public.stortinget_issues i
    WHERE i.id = p_issue_id
      AND (
        i.status = 'closed'
        OR i.ferdigbehandlet IS TRUE
        OR (i.voting_closes_at IS NOT NULL AND i.voting_closes_at <= now())
      )
  ) THEN
    RAISE EXCEPTION 'Voting closed';
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
-- <<< END 20260618120000_sak_voting_status.sql

-- >>> BEGIN 20260618140000_stortinget_issues_category.sql
-- Denormalized list field for fast sak-list queries without Stortinget bulk API.
ALTER TABLE public.stortinget_issues
  ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS idx_stortinget_issues_list_cache
  ON public.stortinget_issues (sak_kind, last_synced_at DESC)
  WHERE sak_kind IS NOT NULL;

COMMENT ON COLUMN public.stortinget_issues.category IS 'Emne/kategori fra Stortinget (emne_liste) eller avledet sakstype';
-- <<< END 20260618140000_stortinget_issues_category.sql

-- >>> BEGIN 20260620120000_points_levels_and_awards.sql
-- Points for reel votes/discuss clicks; always-visible points default.

UPDATE public.users
SET show_points = true
WHERE show_points IS DISTINCT FROM true;

CREATE OR REPLACE FUNCTION public.award_points_for_forum_prompt_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.award_user_points(
    NEW.user_id,
    2,
    'forum_prompt_vote',
    'forum_prompt',
    'prompt-vote:' || NEW.user_id::text || ':' || NEW.prompt_id::text,
    NEW.prompt_id
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_points_for_forum_prompt_vote ON public.forum_prompt_votes;
CREATE TRIGGER trg_award_points_for_forum_prompt_vote
AFTER INSERT ON public.forum_prompt_votes
FOR EACH ROW
EXECUTE FUNCTION public.award_points_for_forum_prompt_vote();

CREATE OR REPLACE FUNCTION public.award_points_for_forum_prompt_discuss()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.award_user_points(
    NEW.user_id,
    1,
    'forum_prompt_discuss',
    'forum_prompt',
    'prompt-discuss:' || NEW.user_id::text || ':' || NEW.prompt_id::text,
    NEW.prompt_id
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_points_for_forum_prompt_discuss ON public.forum_prompt_discuss_clicks;
CREATE TRIGGER trg_award_points_for_forum_prompt_discuss
AFTER INSERT ON public.forum_prompt_discuss_clicks
FOR EACH ROW
EXECUTE FUNCTION public.award_points_for_forum_prompt_discuss();

REVOKE ALL ON FUNCTION public.award_points_for_forum_prompt_vote() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_points_for_forum_prompt_discuss() FROM PUBLIC, anon, authenticated;
-- <<< END 20260620120000_points_levels_and_awards.sql

-- >>> BEGIN 20260620140000_forum_reel_user_submission.sql
-- User-submitted forum reels gated by points tier.

ALTER TABLE public.forum_prompts
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submission_tier text
    CHECK (submission_tier IS NULL OR submission_tier IN ('trusted', 'curator'));

CREATE INDEX IF NOT EXISTS forum_prompts_submitted_by_created_idx
  ON public.forum_prompts (submitted_by, created_at DESC)
  WHERE submitted_by IS NOT NULL;

CREATE OR REPLACE FUNCTION public.normalize_url_hostname(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_host text;
BEGIN
  IF p_url IS NULL OR btrim(p_url) = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_host := lower(
      split_part(
        regexp_replace(
          regexp_replace(btrim(p_url), '^https?://', '', 'i'),
          '[/?#].*$',
          ''
        ),
        ':',
        1
      )
    );
    v_host := regexp_replace(v_host, '^www\.', '');
    RETURN nullif(v_host, '');
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.url_has_trusted_source(p_url text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.normalize_url_hostname(p_url) IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.forum_trusted_sources ts
      WHERE ts.status = 'approved'
        AND (
          public.normalize_url_hostname(p_url) = ts.domain
          OR public.normalize_url_hostname(p_url) LIKE '%.' || ts.domain
        )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.submit_forum_prompt(
  p_user_id uuid,
  p_question text,
  p_source_headlines jsonb,
  p_topic_tags text[] DEFAULT '{}'::text[],
  p_sensitivity text DEFAULT 'low'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_points integer := 0;
  v_question text;
  v_sensitivity text;
  v_submission_tier text;
  v_status text := 'draft';
  v_weekly_limit integer;
  v_weekly_used integer;
  v_prompt_id uuid;
  v_source jsonb;
  v_title text;
  v_url text;
  v_outlet text;
  v_sources jsonb := '[]'::jsonb;
  v_has_source boolean := false;
  v_all_trusted boolean := true;
  v_sort_order integer;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  SELECT coalesce(upb.points, 0)
  INTO v_points
  FROM public.user_points_balances upb
  WHERE upb.user_id = p_user_id;

  IF v_points < 750 THEN
    RAISE EXCEPTION 'insufficient points for reel submission';
  END IF;

  IF v_points >= 2000 THEN
    v_submission_tier := 'curator';
    v_weekly_limit := 5;
  ELSE
    v_submission_tier := 'trusted';
    v_weekly_limit := 2;
  END IF;

  SELECT count(*)::integer
  INTO v_weekly_used
  FROM public.forum_prompts fp
  WHERE fp.submitted_by = p_user_id
    AND fp.created_at > now() - interval '7 days';

  IF v_weekly_used >= v_weekly_limit THEN
    RAISE EXCEPTION 'weekly reel submission limit reached';
  END IF;

  v_question := btrim(coalesce(p_question, ''));
  IF char_length(v_question) < 12 THEN
    RAISE EXCEPTION 'question too short';
  END IF;
  IF char_length(v_question) > 280 THEN
    RAISE EXCEPTION 'question too long';
  END IF;

  v_sensitivity := CASE WHEN lower(coalesce(p_sensitivity, 'low')) = 'high' THEN 'high' ELSE 'low' END;

  IF p_source_headlines IS NULL OR jsonb_typeof(p_source_headlines) <> 'array' THEN
    RAISE EXCEPTION 'sources required';
  END IF;

  FOR v_source IN SELECT value FROM jsonb_array_elements(p_source_headlines)
  LOOP
    v_title := btrim(coalesce(v_source->>'title', ''));
    v_url := btrim(coalesce(v_source->>'url', v_source->>'link', ''));
    v_outlet := btrim(coalesce(nullif(v_source->>'outlet', ''), 'Nyhet'));

    IF v_title = '' OR v_url = '' THEN
      CONTINUE;
    END IF;

    v_has_source := true;
    IF NOT public.url_has_trusted_source(v_url) THEN
      v_all_trusted := false;
    END IF;

    v_sources := v_sources || jsonb_build_array(
      jsonb_build_object(
        'title', v_title,
        'url', v_url,
        'outlet', v_outlet
      )
    );
  END LOOP;

  IF NOT v_has_source THEN
    RAISE EXCEPTION 'sources required';
  END IF;

  IF v_submission_tier = 'curator' AND v_all_trusted THEN
    v_status := 'active';
  ELSE
    v_status := 'draft';
  END IF;

  SELECT coalesce(max(sort_order), 0) + 1
  INTO v_sort_order
  FROM public.forum_prompts;

  INSERT INTO public.forum_prompts (
    question,
    options,
    source_headlines,
    topic_tags,
    sensitivity,
    status,
    sort_order,
    expires_at,
    submitted_by,
    submission_tier
  )
  VALUES (
    v_question,
    '[
      {"id":"ja","label":"Ja"},
      {"id":"nei","label":"Nei"},
      {"id":"ikke_interessert","label":"Ikke interessert"}
    ]'::jsonb,
    v_sources,
    coalesce(p_topic_tags, '{}'::text[]),
    v_sensitivity,
    v_status,
    v_sort_order,
    CASE
      WHEN v_status = 'active' THEN now() + interval '7 days'
      ELSE NULL
    END,
    p_user_id,
    v_submission_tier
  )
  RETURNING id INTO v_prompt_id;

  IF v_status = 'active' THEN
    PERFORM public.award_user_points(
      p_user_id,
      25,
      'reel_published',
      'forum_prompt',
      'reel-published:' || v_prompt_id::text,
      v_prompt_id
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_prompt_id,
    'status', v_status,
    'submission_tier', v_submission_tier,
    'requires_admin', v_status = 'draft',
    'weekly_used', v_weekly_used + 1,
    'weekly_limit', v_weekly_limit
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.award_points_for_approved_user_reel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.submitted_by IS NOT NULL
    AND NEW.status = 'active'
    AND OLD.status = 'draft' THEN
    PERFORM public.award_user_points(
      NEW.submitted_by,
      25,
      'reel_approved',
      'forum_prompt',
      'reel-approved:' || NEW.id::text,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_points_for_approved_user_reel ON public.forum_prompts;
CREATE TRIGGER trg_award_points_for_approved_user_reel
AFTER UPDATE OF status ON public.forum_prompts
FOR EACH ROW
EXECUTE FUNCTION public.award_points_for_approved_user_reel();

REVOKE ALL ON FUNCTION public.submit_forum_prompt(uuid, text, jsonb, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_url_hostname(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.url_has_trusted_source(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_points_for_approved_user_reel() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_forum_prompt(uuid, text, jsonb, text[], text) TO service_role;
-- <<< END 20260620140000_forum_reel_user_submission.sql

-- >>> BEGIN 20260620160000_veteran_source_suggestions.sql
-- Veteran users can suggest new trusted news sources for admin review.

ALTER TABLE public.forum_trusted_sources
  ADD COLUMN IF NOT EXISTS suggested_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS forum_trusted_sources_suggested_by_idx
  ON public.forum_trusted_sources (suggested_by, created_at DESC)
  WHERE suggested_by IS NOT NULL;

CREATE OR REPLACE FUNCTION public.suggest_trusted_news_source(
  p_user_id uuid,
  p_domain text,
  p_outlet_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_points integer := 0;
  v_domain text;
  v_outlet_label text;
  v_monthly_used integer;
  v_source_id uuid;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  SELECT coalesce(upb.points, 0)
  INTO v_points
  FROM public.user_points_balances upb
  WHERE upb.user_id = p_user_id;

  IF v_points < 5000 THEN
    RAISE EXCEPTION 'insufficient points for source suggestion';
  END IF;

  v_domain := lower(regexp_replace(btrim(coalesce(p_domain, '')), '^www\.', ''));
  v_outlet_label := btrim(coalesce(p_outlet_label, ''));

  IF v_domain = '' OR v_domain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN
    RAISE EXCEPTION 'invalid domain';
  END IF;

  IF char_length(v_outlet_label) < 2 OR char_length(v_outlet_label) > 80 THEN
    RAISE EXCEPTION 'invalid outlet label';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.forum_trusted_sources fts
    WHERE fts.domain = v_domain
  ) THEN
    RAISE EXCEPTION 'domain already exists';
  END IF;

  SELECT count(*)::integer
  INTO v_monthly_used
  FROM public.forum_trusted_sources fts
  WHERE fts.suggested_by = p_user_id
    AND fts.created_at > now() - interval '30 days';

  IF v_monthly_used >= 3 THEN
    RAISE EXCEPTION 'monthly source suggestion limit reached';
  END IF;

  INSERT INTO public.forum_trusted_sources (
    domain,
    outlet_label,
    status,
    suggested_by
  )
  VALUES (
    v_domain,
    v_outlet_label,
    'pending',
    p_user_id
  )
  RETURNING id INTO v_source_id;

  RETURN jsonb_build_object(
    'id', v_source_id,
    'domain', v_domain,
    'outlet_label', v_outlet_label,
    'status', 'pending',
    'monthly_used', v_monthly_used + 1,
    'monthly_limit', 3
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.suggest_trusted_news_source(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_trusted_news_source(uuid, text, text) TO service_role;
-- <<< END 20260620160000_veteran_source_suggestions.sql

-- >>> BEGIN 20260621120000_forum_sak_rag_prompts.sql
-- Forum Reels v13: Stortinget-sak RAG prompts + cluster source types

ALTER TABLE public.forum_research_clusters
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'rss';

ALTER TABLE public.forum_research_clusters
  DROP CONSTRAINT IF EXISTS forum_research_clusters_source_type_check;

ALTER TABLE public.forum_research_clusters
  ADD CONSTRAINT forum_research_clusters_source_type_check
  CHECK (source_type IN ('rss', 'stortinget_sak', 'votering', 'user_submission'));

ALTER TABLE public.forum_prompts
  ADD COLUMN IF NOT EXISTS generation_metadata jsonb;

CREATE INDEX IF NOT EXISTS forum_research_clusters_source_type_idx
  ON public.forum_research_clusters (source_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS forum_prompts_generation_source_idx
  ON public.forum_prompts (stortinget_issue_id, status)
  WHERE stortinget_issue_id IS NOT NULL;

COMMENT ON COLUMN public.forum_research_clusters.source_type IS
  'rss | stortinget_sak | votering | user_submission — how the cluster was discovered';

COMMENT ON COLUMN public.forum_prompts.generation_metadata IS
  'Optional RAG / pipeline metadata (chunks used, confidence, source_type)';

CREATE OR REPLACE FUNCTION public.get_sak_prompt_coverage()
RETURNS TABLE (
  pending_issues bigint,
  pending_with_rag bigint,
  pending_with_prompt bigint,
  sak_candidates bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*) FILTER (WHERE i.status = 'pending') AS pending_issues,
    COUNT(*) FILTER (
      WHERE i.status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM public.document_chunks dc
          WHERE dc.issue_id = i.id
            AND dc.embedding_status = 'ready'
        )
    ) AS pending_with_rag,
    COUNT(*) FILTER (
      WHERE i.status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM public.forum_prompts fp
          WHERE fp.stortinget_issue_id = i.id
            AND fp.status IN ('active', 'draft')
        )
    ) AS pending_with_prompt,
    COUNT(*) FILTER (
      WHERE i.status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM public.document_chunks dc
          WHERE dc.issue_id = i.id
            AND dc.embedding_status = 'ready'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.forum_prompts fp
          WHERE fp.stortinget_issue_id = i.id
            AND fp.status IN ('active', 'draft')
        )
    ) AS sak_candidates
  FROM public.stortinget_issues i;
$$;
-- <<< END 20260621120000_forum_sak_rag_prompts.sql

-- >>> BEGIN 20260702160000_backfill_ferdigbehandlet_from_detail.sql
-- Align denormalized ferdigbehandlet with cached detail_json when they drift.
update public.stortinget_issues
set ferdigbehandlet = (detail_json->>'ferdigbehandlet')::boolean
where detail_json ? 'ferdigbehandlet'
  and jsonb_typeof(detail_json->'ferdigbehandlet') = 'boolean'
  and ferdigbehandlet is distinct from (detail_json->>'ferdigbehandlet')::boolean;
-- <<< END 20260702160000_backfill_ferdigbehandlet_from_detail.sql

-- >>> BEGIN 20260716120000_politiker_profile_support.sql
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
-- <<< END 20260716120000_politiker_profile_support.sql

