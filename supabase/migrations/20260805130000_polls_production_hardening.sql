-- Production hardening for direct-democracy polls (PR #57 follow-up)
-- 1) Lock vote encryption helpers to server roles only
-- 2) Net-upvote ranking for poll top arguments (likes - dislikes)
-- 3) MinID-gated fylke: stop client self-serve fylke edits; ballots only copy verified fylke

-- ---------------------------------------------------------------------------
-- 1. Encryption: never callable from anon/authenticated clients
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.get_setting(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vote_encryption_key(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_vote_choice(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_vote_choice(uuid, bytea) FROM PUBLIC, anon, authenticated;

-- SECURITY DEFINER poll/sak RPCs run as owner and can still call these.
GRANT EXECUTE ON FUNCTION private.get_setting(text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.vote_encryption_key(uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_vote_choice(uuid, text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_vote_choice(uuid, bytea) TO postgres, service_role;

-- Hot-path indexes for cast_poll_vote / totals
-- PK (user_id, poll_id) already covers receipt double-vote checks.
CREATE INDEX IF NOT EXISTS poll_votes_poll_choice_idx
  ON public.poll_votes (poll_id, choice);

-- choice_encrypted is write-only payload; indexing it adds cost without helping lookups.
-- Receipt lookups are by (user_id, poll_id) via PK.

-- ---------------------------------------------------------------------------
-- 2. Forum dislikes → net_upvotes for top arguments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forum_dislikes (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('thread', 'reply')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS forum_dislikes_target_idx
  ON public.forum_dislikes (target_type, target_id);

ALTER TABLE public.forum_dislikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forum_dislikes_select ON public.forum_dislikes;
CREATE POLICY forum_dislikes_select ON public.forum_dislikes
  FOR SELECT TO anon, authenticated
  USING (true);

-- Mutual exclusion: liking removes dislike and vice versa
-- Keep boolean return type to match existing app/api/forum toggle_like contract
CREATE OR REPLACE FUNCTION public.toggle_forum_dislike(
  p_user_id uuid,
  p_target_type text,
  p_target_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
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
    SELECT 1 FROM public.forum_dislikes
    WHERE user_id = p_user_id AND target_type = p_target_type AND target_id = p_target_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.forum_dislikes
    WHERE user_id = p_user_id AND target_type = p_target_type AND target_id = p_target_id;
    RETURN false;
  END IF;

  DELETE FROM public.forum_likes
  WHERE user_id = p_user_id AND target_type = p_target_type AND target_id = p_target_id;

  INSERT INTO public.forum_dislikes (user_id, target_type, target_id)
  VALUES (p_user_id, p_target_type, p_target_id);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_forum_dislike(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_forum_dislike(uuid, text, uuid) TO service_role;

-- When liking, clear any dislike. Preserve boolean return type.
CREATE OR REPLACE FUNCTION public.toggle_forum_like(
  p_user_id uuid,
  p_target_type text,
  p_target_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
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
    WHERE user_id = p_user_id AND target_type = p_target_type AND target_id = p_target_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.forum_likes
    WHERE user_id = p_user_id AND target_type = p_target_type AND target_id = p_target_id;
    RETURN false;
  END IF;

  DELETE FROM public.forum_dislikes
  WHERE user_id = p_user_id AND target_type = p_target_type AND target_id = p_target_id;

  INSERT INTO public.forum_likes (user_id, target_type, target_id)
  VALUES (p_user_id, p_target_type, p_target_id);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_forum_like(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_forum_like(uuid, text, uuid) TO service_role;

-- Rank by net_upvotes = likes - dislikes
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

  WITH scored AS (
    SELECT
      r.id,
      r.body,
      r.stance,
      r.created_at,
      r.author_user_id,
      coalesce(u.first_name, '') AS first_name,
      coalesce(u.last_name, '') AS last_name,
      coalesce(like_counts.cnt, 0) AS like_count,
      coalesce(dislike_counts.cnt, 0) AS dislike_count,
      coalesce(like_counts.cnt, 0) - coalesce(dislike_counts.cnt, 0) AS net_upvotes,
      row_number() OVER (
        PARTITION BY r.stance
        ORDER BY
          (coalesce(like_counts.cnt, 0) - coalesce(dislike_counts.cnt, 0)) DESC,
          coalesce(like_counts.cnt, 0) DESC,
          r.created_at ASC
      ) AS rn
    FROM public.forum_replies r
    LEFT JOIN public.users u ON u.id = r.author_user_id
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS cnt
      FROM public.forum_likes l
      WHERE l.target_type = 'reply' AND l.target_id = r.id
    ) like_counts ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS cnt
      FROM public.forum_dislikes d
      WHERE d.target_type = 'reply' AND d.target_id = r.id
    ) dislike_counts ON true
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
          'dislikeCount', dislike_count,
          'netUpvotes', net_upvotes,
          'authorName', nullif(trim(first_name || ' ' || last_name), ''),
          'createdAt', created_at
        )
        ORDER BY net_upvotes DESC, like_count DESC, created_at ASC
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
          'dislikeCount', dislike_count,
          'netUpvotes', net_upvotes,
          'authorName', nullif(trim(first_name || ' ' || last_name), ''),
          'createdAt', created_at
        )
        ORDER BY net_upvotes DESC, like_count DESC, created_at ASC
      ) FILTER (WHERE stance = 'nei' AND rn <= v_limit),
      '[]'::jsonb
    )
  INTO v_ja, v_nei
  FROM scored;

  RETURN jsonb_build_object(
    'ja', coalesce(v_ja, '[]'::jsonb),
    'nei', coalesce(v_nei, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_poll_top_arguments(uuid, int) TO service_role, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. MinID-verified fylke (not client-editable)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS fylke_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fylke_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS fylke_source text;

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

-- Clear any previously self-serve fylke values that were never verified
UPDATE public.users
SET
  fylke_code = NULL,
  fylke_verified = false,
  fylke_verified_at = NULL,
  fylke_source = NULL
WHERE fylke_verified IS NOT TRUE
  AND fylke_code IS NOT NULL;

-- Service-only claim writer used after MinID / ID-porten (or secure mock in dev)
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

  -- Mark identity verified for future BankID/MinID gates (do not auto-true on every vote)
  INSERT INTO public.user_profiles (user_id, identity_verified, verified_at)
  VALUES (p_user_id, true, now())
  ON CONFLICT (user_id) DO UPDATE
  SET identity_verified = true,
      verified_at = coalesce(public.user_profiles.verified_at, now());

  RETURN jsonb_build_object(
    'userId', p_user_id,
    'fylkeCode', v_code,
    'fylkeVerified', true,
    'fylkeSource', v_source
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_verified_fylke_claim(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_fylke_claim(uuid, text, text) TO service_role;

-- cast_poll_vote: only attach fylke when MinID/ID-porten verified; never force identity_verified
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

  -- Fast path: PK lookup on poll_vote_receipts (user_id, poll_id)
  IF EXISTS (
    SELECT 1 FROM public.poll_vote_receipts
    WHERE user_id = p_user_id AND poll_id = p_poll_id
  ) THEN
    RAISE EXCEPTION 'Already voted';
  END IF;

  -- Only copy fylke when claimed via MinID/ID-porten (or approved mock). Else NULL = ukjent.
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

REVOKE ALL ON FUNCTION public.cast_poll_vote(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_poll_vote(uuid, uuid, text) TO service_role;
