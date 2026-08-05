-- Direct democracy polls module (Swiss-inspired advisory votes for Norway)
-- Extends the existing anonymous ballot + encrypted receipt pattern with:
--   dual track (stortinget | citizen), fylke breakdown, forum argument stance,
--   and citizen initiatives that promote to national Ja/Nei/Blank polls.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 1. Norwegian counties (15 fylker after 2024 reform)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.norway_counties (
  code text PRIMARY KEY,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

INSERT INTO public.norway_counties (code, name, sort_order) VALUES
  ('03', 'Oslo', 1),
  ('11', 'Rogaland', 2),
  ('15', 'Møre og Romsdal', 3),
  ('18', 'Nordland', 4),
  ('31', 'Østfold', 5),
  ('32', 'Akershus', 6),
  ('33', 'Buskerud', 7),
  ('34', 'Innlandet', 8),
  ('39', 'Vestfold', 9),
  ('40', 'Telemark', 10),
  ('42', 'Agder', 11),
  ('46', 'Vestland', 12),
  ('50', 'Trøndelag', 13),
  ('55', 'Troms', 14),
  ('56', 'Finnmark', 15)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

ALTER TABLE public.norway_counties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS norway_counties_select_all ON public.norway_counties;
CREATE POLICY norway_counties_select_all ON public.norway_counties
  FOR SELECT TO anon, authenticated
  USING (true);

-- Optional fylke on public profile (used only as demographic copy onto ballots)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS fylke_code text REFERENCES public.norway_counties (code);

CREATE INDEX IF NOT EXISTS users_fylke_code_idx ON public.users (fylke_code);

-- ---------------------------------------------------------------------------
-- 2. Polls (Stortinget track + citizen track)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  track text NOT NULL CHECK (track IN ('stortinget', 'citizen')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  title text NOT NULL,
  neutral_summary text NOT NULL DEFAULT '',
  source_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  stortinget_issue_id text REFERENCES public.stortinget_issues (id) ON DELETE SET NULL,
  forum_thread_id uuid REFERENCES public.forum_threads (id) ON DELETE SET NULL,
  citizen_initiative_id uuid,
  opens_at timestamptz,
  closes_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT polls_stortinget_track_requires_issue CHECK (
    track <> 'stortinget' OR stortinget_issue_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS polls_stortinget_issue_uidx
  ON public.polls (stortinget_issue_id)
  WHERE stortinget_issue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS polls_status_track_idx
  ON public.polls (status, track, created_at DESC);

CREATE INDEX IF NOT EXISTS polls_forum_thread_idx
  ON public.polls (forum_thread_id)
  WHERE forum_thread_id IS NOT NULL;

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS polls_select_public ON public.polls;
CREATE POLICY polls_select_public ON public.polls
  FOR SELECT TO anon, authenticated
  USING (status IN ('open', 'closed'));

-- ---------------------------------------------------------------------------
-- 3. Anonymous poll ballots + encrypted receipts (1 person = 1 vote)
-- ---------------------------------------------------------------------------
-- Ballots never store user_id. fylke_code is a demographic attribute copied
-- at cast time from the voter's profile (nullable if not set).
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls (id) ON DELETE CASCADE,
  choice text NOT NULL CHECK (choice IN ('ja', 'nei', 'blank')),
  fylke_code text REFERENCES public.norway_counties (code),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS poll_votes_poll_idx ON public.poll_votes (poll_id);
CREATE INDEX IF NOT EXISTS poll_votes_poll_fylke_idx ON public.poll_votes (poll_id, fylke_code);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS poll_votes_deny_all ON public.poll_votes;
CREATE POLICY poll_votes_deny_all ON public.poll_votes
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Receipt proves the user voted; choice is encrypted with per-user key material.
CREATE TABLE IF NOT EXISTS public.poll_vote_receipts (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  poll_id uuid NOT NULL REFERENCES public.polls (id) ON DELETE CASCADE,
  choice_encrypted bytea NOT NULL,
  voted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, poll_id)
);

CREATE INDEX IF NOT EXISTS poll_vote_receipts_user_idx
  ON public.poll_vote_receipts (user_id);

ALTER TABLE public.poll_vote_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS poll_vote_receipts_select_own ON public.poll_vote_receipts;
CREATE POLICY poll_vote_receipts_select_own ON public.poll_vote_receipts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Citizen initiatives (folkinitiativ → poll when threshold met)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.citizen_initiatives (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  forum_thread_id uuid NOT NULL REFERENCES public.forum_threads (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  support_threshold int NOT NULL DEFAULT 500 CHECK (support_threshold > 0),
  support_count int NOT NULL DEFAULT 0 CHECK (support_count >= 0),
  status text NOT NULL DEFAULT 'gathering'
    CHECK (status IN ('gathering', 'threshold_met', 'promoted', 'rejected', 'withdrawn')),
  promoted_poll_id uuid REFERENCES public.polls (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS citizen_initiatives_status_idx
  ON public.citizen_initiatives (status, support_count DESC);

CREATE INDEX IF NOT EXISTS citizen_initiatives_thread_idx
  ON public.citizen_initiatives (forum_thread_id);

ALTER TABLE public.citizen_initiatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS citizen_initiatives_select_public ON public.citizen_initiatives;
CREATE POLICY citizen_initiatives_select_public ON public.citizen_initiatives
  FOR SELECT TO anon, authenticated
  USING (status IN ('gathering', 'threshold_met', 'promoted'));

-- Deferred FK from polls → citizen_initiatives
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'polls_citizen_initiative_id_fkey'
  ) THEN
    ALTER TABLE public.polls
      ADD CONSTRAINT polls_citizen_initiative_id_fkey
      FOREIGN KEY (citizen_initiative_id)
      REFERENCES public.citizen_initiatives (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.citizen_initiative_endorsements (
  initiative_id uuid NOT NULL REFERENCES public.citizen_initiatives (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (initiative_id, user_id)
);

CREATE INDEX IF NOT EXISTS citizen_initiative_endorsements_user_idx
  ON public.citizen_initiative_endorsements (user_id);

ALTER TABLE public.citizen_initiative_endorsements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS citizen_initiative_endorsements_select_own ON public.citizen_initiative_endorsements;
CREATE POLICY citizen_initiative_endorsements_select_own ON public.citizen_initiative_endorsements
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Forum argument stance (Ja / Nei) for top-pro / top-contra on poll cards
-- ---------------------------------------------------------------------------
ALTER TABLE public.forum_replies
  ADD COLUMN IF NOT EXISTS stance text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'forum_replies_stance_check'
  ) THEN
    ALTER TABLE public.forum_replies
      ADD CONSTRAINT forum_replies_stance_check
      CHECK (stance IS NULL OR stance IN ('ja', 'nei', 'neutral'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS forum_replies_thread_stance_idx
  ON public.forum_replies (thread_id, stance)
  WHERE stance IN ('ja', 'nei');

-- ---------------------------------------------------------------------------
-- 6. RPCs — totals, cast vote, top arguments, initiatives
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_poll_totals(p_poll_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ja int;
  v_nei int;
  v_blank int;
BEGIN
  SELECT
    count(*) FILTER (WHERE choice = 'ja'),
    count(*) FILTER (WHERE choice = 'nei'),
    count(*) FILTER (WHERE choice = 'blank')
  INTO v_ja, v_nei, v_blank
  FROM public.poll_votes
  WHERE poll_id = p_poll_id;

  RETURN jsonb_build_object(
    'ja', coalesce(v_ja, 0),
    'nei', coalesce(v_nei, 0),
    'blank', coalesce(v_blank, 0),
    'total', coalesce(v_ja, 0) + coalesce(v_nei, 0) + coalesce(v_blank, 0)
  );
END;
$$;

-- Regional breakdown. Counties below p_min_votes are suppressed (k-anonymity).
CREATE OR REPLACE FUNCTION public.get_poll_totals_by_fylke(
  p_poll_id uuid,
  p_min_votes int DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  row record;
  v_min int := greatest(coalesce(p_min_votes, 5), 1);
BEGIN
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

CREATE OR REPLACE FUNCTION public.get_user_poll_vote(p_user_id uuid, p_poll_id uuid)
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
  FROM public.poll_vote_receipts
  WHERE user_id = p_user_id AND poll_id = p_poll_id;

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

CREATE OR REPLACE FUNCTION public.cast_poll_vote(
  p_user_id uuid,
  p_poll_id uuid,
  p_choice text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_poll public.polls%ROWTYPE;
  v_fylke text;
BEGIN
  IF p_choice IS NULL OR p_choice NOT IN ('ja', 'nei', 'blank') THEN
    RAISE EXCEPTION 'Invalid vote choice';
  END IF;

  SELECT * INTO v_poll FROM public.polls WHERE id = p_poll_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;

  IF v_poll.status <> 'open' THEN
    RAISE EXCEPTION 'Voting closed';
  END IF;

  IF v_poll.closes_at IS NOT NULL AND v_poll.closes_at <= now() THEN
    RAISE EXCEPTION 'Voting closed';
  END IF;

  IF v_poll.opens_at IS NOT NULL AND v_poll.opens_at > now() THEN
    RAISE EXCEPTION 'Voting not open yet';
  END IF;

  -- Soft identity gate (BankID can flip identity_verified later without schema change)
  INSERT INTO public.user_profiles (user_id, identity_verified, verified_at)
  VALUES (p_user_id, true, now())
  ON CONFLICT (user_id) DO UPDATE
  SET identity_verified = true,
      verified_at = coalesce(public.user_profiles.verified_at, now());

  IF EXISTS (
    SELECT 1 FROM public.poll_vote_receipts
    WHERE user_id = p_user_id AND poll_id = p_poll_id
  ) THEN
    RAISE EXCEPTION 'Already voted';
  END IF;

  SELECT fylke_code INTO v_fylke FROM public.users WHERE id = p_user_id;

  -- Anonymous ballot (no user_id)
  INSERT INTO public.poll_votes (poll_id, choice, fylke_code)
  VALUES (p_poll_id, p_choice, v_fylke);

  -- Receipt with encrypted choice (1p1v enforcement)
  INSERT INTO public.poll_vote_receipts (user_id, poll_id, choice_encrypted)
  VALUES (p_user_id, p_poll_id, public.encrypt_vote_choice(p_user_id, p_choice));

  RETURN public.get_poll_totals(p_poll_id);
END;
$$;

-- Top Ja / Nei arguments from the poll's dedicated forum thread (by likes)
CREATE OR REPLACE FUNCTION public.get_poll_top_arguments(
  p_poll_id uuid,
  p_limit_per_side int DEFAULT 2
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id uuid;
  v_limit int := greatest(coalesce(p_limit_per_side, 2), 1);
  v_ja jsonb;
  v_nei jsonb;
BEGIN
  SELECT forum_thread_id INTO v_thread_id FROM public.polls WHERE id = p_poll_id;
  IF v_thread_id IS NULL THEN
    RETURN jsonb_build_object('ja', '[]'::jsonb, 'nei', '[]'::jsonb);
  END IF;

  WITH ranked AS (
    SELECT
      r.id,
      r.body,
      r.stance,
      r.created_at,
      r.author_user_id,
      coalesce(u.first_name, '') AS first_name,
      coalesce(u.last_name, '') AS last_name,
      coalesce(like_counts.cnt, 0) AS like_count,
      row_number() OVER (
        PARTITION BY r.stance
        ORDER BY coalesce(like_counts.cnt, 0) DESC, r.created_at ASC
      ) AS rn
    FROM public.forum_replies r
    LEFT JOIN public.users u ON u.id = r.author_user_id
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS cnt
      FROM public.forum_likes l
      WHERE l.target_type = 'reply' AND l.target_id = r.id
    ) like_counts ON true
    WHERE r.thread_id = v_thread_id
      AND r.stance IN ('ja', 'nei')
      AND r.moderation_status = 'approved'
      AND r.parent_reply_id IS NULL
  )
  SELECT
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'body', body,
          'stance', stance,
          'likeCount', like_count,
          'authorName', nullif(trim(first_name || ' ' || last_name), ''),
          'createdAt', created_at
        )
        ORDER BY like_count DESC, created_at ASC
      ) FILTER (WHERE stance = 'ja' AND rn <= v_limit),
      '[]'::jsonb
    ),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'body', body,
          'stance', stance,
          'likeCount', like_count,
          'authorName', nullif(trim(first_name || ' ' || last_name), ''),
          'createdAt', created_at
        )
        ORDER BY like_count DESC, created_at ASC
      ) FILTER (WHERE stance = 'nei' AND rn <= v_limit),
      '[]'::jsonb
    )
  INTO v_ja, v_nei
  FROM ranked;

  RETURN jsonb_build_object(
    'ja', coalesce(v_ja, '[]'::jsonb),
    'nei', coalesce(v_nei, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.endorse_citizen_initiative(
  p_user_id uuid,
  p_initiative_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_init public.citizen_initiatives%ROWTYPE;
  v_count int;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  SELECT * INTO v_init FROM public.citizen_initiatives WHERE id = p_initiative_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Initiative not found';
  END IF;

  IF v_init.status NOT IN ('gathering', 'threshold_met') THEN
    RAISE EXCEPTION 'Initiative not open for endorsements';
  END IF;

  INSERT INTO public.citizen_initiative_endorsements (initiative_id, user_id)
  VALUES (p_initiative_id, p_user_id)
  ON CONFLICT DO NOTHING;

  SELECT count(*)::int INTO v_count
  FROM public.citizen_initiative_endorsements
  WHERE initiative_id = p_initiative_id;

  UPDATE public.citizen_initiatives
  SET
    support_count = v_count,
    status = CASE
      WHEN v_count >= support_threshold AND status = 'gathering' THEN 'threshold_met'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_initiative_id
  RETURNING * INTO v_init;

  RETURN jsonb_build_object(
    'initiativeId', v_init.id,
    'supportCount', v_init.support_count,
    'supportThreshold', v_init.support_threshold,
    'status', v_init.status,
    'endorsed', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_citizen_initiative_to_poll(
  p_initiative_id uuid,
  p_actor_user_id uuid DEFAULT NULL,
  p_force boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_init public.citizen_initiatives%ROWTYPE;
  v_poll_id uuid;
  v_summary text;
BEGIN
  SELECT * INTO v_init FROM public.citizen_initiatives WHERE id = p_initiative_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Initiative not found';
  END IF;

  IF v_init.status = 'promoted' AND v_init.promoted_poll_id IS NOT NULL THEN
    RETURN v_init.promoted_poll_id;
  END IF;

  IF NOT p_force AND v_init.status NOT IN ('threshold_met', 'gathering') THEN
    RAISE EXCEPTION 'Initiative cannot be promoted from status %', v_init.status;
  END IF;

  IF NOT p_force AND v_init.support_count < v_init.support_threshold THEN
    RAISE EXCEPTION 'Support threshold not met';
  END IF;

  v_summary := left(btrim(v_init.body), 2000);

  INSERT INTO public.polls (
    track,
    status,
    title,
    neutral_summary,
    forum_thread_id,
    citizen_initiative_id,
    opens_at,
    created_by
  )
  VALUES (
    'citizen',
    'open',
    v_init.title,
    v_summary,
    v_init.forum_thread_id,
    v_init.id,
    now(),
    p_actor_user_id
  )
  RETURNING id INTO v_poll_id;

  UPDATE public.citizen_initiatives
  SET
    status = 'promoted',
    promoted_poll_id = v_poll_id,
    updated_at = now()
  WHERE id = p_initiative_id;

  RETURN v_poll_id;
END;
$$;

-- Ensure a Stortinget-track poll exists for an issue (idempotent)
CREATE OR REPLACE FUNCTION public.ensure_stortinget_poll(
  p_issue_id text,
  p_title text,
  p_neutral_summary text DEFAULT '',
  p_forum_thread_id uuid DEFAULT NULL,
  p_source_urls jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poll_id uuid;
BEGIN
  IF p_issue_id IS NULL OR btrim(p_issue_id) = '' THEN
    RAISE EXCEPTION 'Missing issue id';
  END IF;

  INSERT INTO public.stortinget_issues (id, title, summary, last_synced_at)
  VALUES (
    p_issue_id,
    coalesce(nullif(btrim(p_title), ''), 'Sak ' || p_issue_id),
    nullif(btrim(p_neutral_summary), ''),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = coalesce(nullif(btrim(EXCLUDED.title), ''), public.stortinget_issues.title),
    summary = coalesce(EXCLUDED.summary, public.stortinget_issues.summary),
    last_synced_at = now();

  SELECT id INTO v_poll_id
  FROM public.polls
  WHERE stortinget_issue_id = p_issue_id
  LIMIT 1;

  IF v_poll_id IS NOT NULL THEN
    UPDATE public.polls
    SET
      title = coalesce(nullif(btrim(p_title), ''), title),
      neutral_summary = CASE
        WHEN nullif(btrim(p_neutral_summary), '') IS NOT NULL THEN btrim(p_neutral_summary)
        ELSE neutral_summary
      END,
      forum_thread_id = coalesce(p_forum_thread_id, forum_thread_id),
      source_urls = CASE
        WHEN p_source_urls IS NOT NULL AND p_source_urls <> '[]'::jsonb THEN p_source_urls
        ELSE source_urls
      END,
      updated_at = now()
    WHERE id = v_poll_id;
    RETURN v_poll_id;
  END IF;

  INSERT INTO public.polls (
    track,
    status,
    title,
    neutral_summary,
    stortinget_issue_id,
    forum_thread_id,
    source_urls,
    opens_at
  )
  VALUES (
    'stortinget',
    'open',
    coalesce(nullif(btrim(p_title), ''), 'Sak ' || p_issue_id),
    coalesce(nullif(btrim(p_neutral_summary), ''), ''),
    p_issue_id,
    p_forum_thread_id,
    coalesce(p_source_urls, '[]'::jsonb),
    now()
  )
  RETURNING id INTO v_poll_id;

  RETURN v_poll_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_citizen_initiative(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_support_threshold int DEFAULT 500
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_thread_id uuid;
  v_initiative_id uuid;
  v_title text := btrim(p_title);
  v_body text := btrim(p_body);
  v_threshold int := coalesce(p_support_threshold, 500);
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_forum_identity(p_user_id) THEN
    RAISE EXCEPTION 'Forum identity required';
  END IF;

  IF char_length(v_title) < 5 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 5 and 200 characters';
  END IF;

  IF char_length(v_body) < 20 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 20 and 10000 characters';
  END IF;

  IF v_threshold < 10 THEN
    v_threshold := 10;
  END IF;

  v_thread_id := public.create_forum_thread(
    p_user_id,
    v_title,
    v_body,
    NULL,
    jsonb_build_array(
      jsonb_build_object('type', 'initiative', 'label', 'Borgerinitiativ')
    ),
    false
  );

  INSERT INTO public.citizen_initiatives (
    title, body, forum_thread_id, author_user_id, support_threshold
  )
  VALUES (v_title, v_body, v_thread_id, p_user_id, v_threshold)
  RETURNING id INTO v_initiative_id;

  -- Author auto-endorses
  INSERT INTO public.citizen_initiative_endorsements (initiative_id, user_id)
  VALUES (v_initiative_id, p_user_id);

  UPDATE public.citizen_initiatives
  SET support_count = 1, updated_at = now()
  WHERE id = v_initiative_id;

  RETURN v_initiative_id;
END;
$$;

-- Grants (service role for writes; aggregates readable by clients via RPC)
GRANT EXECUTE ON FUNCTION public.get_poll_totals(uuid) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_poll_totals_by_fylke(uuid, int) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_poll_vote(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cast_poll_vote(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_poll_top_arguments(uuid, int) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.endorse_citizen_initiative(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_citizen_initiative_to_poll(uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_stortinget_poll(text, text, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_citizen_initiative(uuid, text, text, int) TO service_role;
