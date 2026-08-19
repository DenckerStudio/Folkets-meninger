-- Swiss-inspired advisory polls (Ja/Nei/Blank) and citizen initiatives.
-- No forum coupling: F0 dropped top-arguments and forum_thread_id.

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

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS fylke_code text REFERENCES public.norway_counties (code),
  ADD COLUMN IF NOT EXISTS fylke_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fylke_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS fylke_source text;

CREATE INDEX IF NOT EXISTS users_fylke_code_idx ON public.users (fylke_code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_fylke_source_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_fylke_source_check
      CHECK (
        fylke_source IS NULL
        OR fylke_source IN ('minid', 'idporten', 'bankid', 'mock_minid')
      );
  END IF;
END $$;

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

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS polls_select_public ON public.polls;
CREATE POLICY polls_select_public ON public.polls
  FOR SELECT TO anon, authenticated
  USING (status IN ('open', 'closed'));

-- ---------------------------------------------------------------------------
-- 3. Anonymous poll ballots + encrypted receipts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls (id) ON DELETE CASCADE,
  choice text NOT NULL CHECK (choice IN ('ja', 'nei', 'blank')),
  fylke_code text REFERENCES public.norway_counties (code),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS poll_votes_poll_idx ON public.poll_votes (poll_id);
CREATE INDEX IF NOT EXISTS poll_votes_poll_fylke_idx ON public.poll_votes (poll_id, fylke_code);
CREATE INDEX IF NOT EXISTS poll_votes_poll_choice_idx ON public.poll_votes (poll_id, choice);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS poll_votes_deny_all ON public.poll_votes;
CREATE POLICY poll_votes_deny_all ON public.poll_votes
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

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
-- 4. Citizen initiatives (title/body only — no forum thread)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.citizen_initiatives (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
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

ALTER TABLE public.citizen_initiatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS citizen_initiatives_select_public ON public.citizen_initiatives;
CREATE POLICY citizen_initiatives_select_public ON public.citizen_initiatives
  FOR SELECT TO anon, authenticated
  USING (status IN ('gathering', 'threshold_met', 'promoted'));

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
-- 5. RPCs
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
  v_fylke_verified boolean;
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

  IF EXISTS (
    SELECT 1 FROM public.poll_vote_receipts
    WHERE user_id = p_user_id AND poll_id = p_poll_id
  ) THEN
    RAISE EXCEPTION 'Already voted';
  END IF;

  SELECT
    CASE WHEN fylke_verified THEN fylke_code ELSE NULL END,
    coalesce(fylke_verified, false)
  INTO v_fylke, v_fylke_verified
  FROM public.users
  WHERE id = p_user_id;

  INSERT INTO public.poll_votes (poll_id, choice, fylke_code)
  VALUES (p_poll_id, p_choice, v_fylke);

  INSERT INTO public.poll_vote_receipts (user_id, poll_id, choice_encrypted)
  VALUES (p_user_id, p_poll_id, public.encrypt_vote_choice(p_user_id, p_choice));

  RETURN public.get_poll_totals(p_poll_id) || jsonb_build_object(
    'fylkeAttached', v_fylke IS NOT NULL,
    'fylkeVerified', coalesce(v_fylke_verified, false)
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
    citizen_initiative_id,
    opens_at,
    created_by
  )
  VALUES (
    'citizen',
    'open',
    v_init.title,
    v_summary,
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

CREATE OR REPLACE FUNCTION public.ensure_stortinget_poll(
  p_issue_id text,
  p_title text,
  p_neutral_summary text DEFAULT '',
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
    source_urls,
    opens_at
  )
  VALUES (
    'stortinget',
    'open',
    coalesce(nullif(btrim(p_title), ''), 'Sak ' || p_issue_id),
    coalesce(nullif(btrim(p_neutral_summary), ''), ''),
    p_issue_id,
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
  v_initiative_id uuid;
  v_title text := btrim(p_title);
  v_body text := btrim(p_body);
  v_threshold int := coalesce(p_support_threshold, 500);
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_public_identity(p_user_id) THEN
    RAISE EXCEPTION 'Public identity required';
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

  INSERT INTO public.citizen_initiatives (
    title, body, author_user_id, support_threshold
  )
  VALUES (v_title, v_body, p_user_id, v_threshold)
  RETURNING id INTO v_initiative_id;

  INSERT INTO public.citizen_initiative_endorsements (initiative_id, user_id)
  VALUES (v_initiative_id, p_user_id);

  UPDATE public.citizen_initiatives
  SET support_count = 1, updated_at = now()
  WHERE id = v_initiative_id;

  RETURN v_initiative_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_verified_fylke_claim(
  p_user_id uuid,
  p_fylke_code text,
  p_source text DEFAULT 'minid'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := nullif(btrim(p_fylke_code), '');
  v_source text := coalesce(nullif(btrim(p_source), ''), 'minid');
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user id';
  END IF;

  IF v_source NOT IN ('minid', 'idporten', 'bankid', 'mock_minid') THEN
    RAISE EXCEPTION 'Invalid fylke source';
  END IF;

  IF v_code IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.norway_counties WHERE code = v_code
  ) THEN
    RAISE EXCEPTION 'Invalid fylke code';
  END IF;

  PERFORM public.ensure_public_user(p_user_id);

  UPDATE public.users
  SET
    fylke_code = v_code,
    fylke_verified = true,
    fylke_verified_at = now(),
    fylke_source = v_source
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'userId', p_user_id,
    'fylkeCode', v_code,
    'fylkeVerified', true,
    'fylkeSource', v_source
  );
END;
$$;

-- Encryption helpers stay server-only
REVOKE ALL ON FUNCTION private.get_setting(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vote_encryption_key(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_vote_choice(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_vote_choice(uuid, bytea) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_setting(text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.vote_encryption_key(uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_vote_choice(uuid, text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_vote_choice(uuid, bytea) TO postgres, service_role;

REVOKE ALL ON FUNCTION public.get_poll_totals(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_poll_totals_by_fylke(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_poll_vote(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cast_poll_vote(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.endorse_citizen_initiative(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.promote_citizen_initiative_to_poll(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_stortinget_poll(text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_citizen_initiative(uuid, text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_verified_fylke_claim(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_poll_totals(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_poll_totals_by_fylke(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_poll_vote(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cast_poll_vote(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.endorse_citizen_initiative(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_citizen_initiative_to_poll(uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_stortinget_poll(text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_citizen_initiative(uuid, text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_verified_fylke_claim(uuid, text, text) TO service_role;
