-- Hide retired system polls (track=system) from anon/authenticated reads and public aggregates.
-- Manual apply only. Does not close or delete rows.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. polls RLS: public open/closed excludes track=system; admins see all rows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS polls_select_public ON public.polls;
CREATE POLICY polls_select_public ON public.polls
  FOR SELECT TO anon, authenticated
  USING (
    status IN ('open', 'closed')
    AND track <> 'system'
  );

DROP POLICY IF EXISTS polls_select_admin ON public.polls;
CREATE POLICY polls_select_admin ON public.polls
  FOR SELECT TO authenticated
  USING (public.is_admin());

COMMENT ON POLICY polls_select_public ON public.polls IS
  'Published stortinget/citizen polls only; retired system polls are hidden from public API/RLS.';

COMMENT ON POLICY polls_select_admin ON public.polls IS
  'Admins read all poll tracks/statuses via is_admin().';

-- ---------------------------------------------------------------------------
-- 2. Helper: may anon/authenticated aggregate totals for this poll?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.poll_allows_public_aggregate(p_poll_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COALESCE(auth.role(), '') = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND public.is_admin()
    )
    OR EXISTS (
      SELECT 1
      FROM public.polls p
      WHERE p.id = p_poll_id
        AND p.status IN ('open', 'closed')
        AND p.track <> 'system'
    );
$$;

COMMENT ON FUNCTION public.poll_allows_public_aggregate(uuid) IS
  'True when poll totals may be returned to anon/authenticated (excludes retired system polls).';

REVOKE ALL ON FUNCTION public.poll_allows_public_aggregate(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.poll_allows_public_aggregate(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Public aggregate RPCs — no totals for retired system polls
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_poll_totals(p_poll_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ja int;
  v_nei int;
  v_blank int;
BEGIN
  IF NOT public.poll_allows_public_aggregate(p_poll_id) THEN
    RETURN jsonb_build_object('ja', 0, 'nei', 0, 'blank', 0, 'total', 0);
  END IF;

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
  p_min_votes int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  row record;
  v_min int := greatest(coalesce(p_min_votes, 10), 10);
BEGIN
  IF NOT public.poll_allows_public_aggregate(p_poll_id) THEN
    RETURN '[]'::jsonb;
  END IF;

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

COMMENT ON FUNCTION public.get_poll_totals(uuid) IS
  'Aggregate ja/nei/blank counts only; retired system polls return zeros for non-admin callers.';

COMMENT ON FUNCTION public.get_poll_totals_by_fylke(uuid, int) IS
  'Per-fylke aggregates; retired system polls return [] for non-admin callers.';

REVOKE ALL ON FUNCTION public.get_poll_totals(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_poll_totals_by_fylke(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_poll_totals(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_poll_totals_by_fylke(uuid, int) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. cast_poll_vote / get_user_poll_vote — block retired system polls
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cast_poll_vote(
  p_user_id uuid,
  p_poll_id uuid,
  p_choice text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_poll public.polls%ROWTYPE;
  v_fylke text;
  v_fylke_verified boolean;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);
  IF p_choice IS NULL OR p_choice NOT IN ('ja', 'nei', 'blank') THEN
    RAISE EXCEPTION 'Invalid vote choice';
  END IF;

  SELECT * INTO v_poll FROM public.polls WHERE id = p_poll_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;

  IF v_poll.track = 'system' THEN
    RAISE EXCEPTION 'Voting closed';
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

CREATE OR REPLACE FUNCTION public.get_user_poll_vote(p_user_id uuid, p_poll_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_encrypted bytea;
  v_choice text;
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);

  IF EXISTS (
    SELECT 1
    FROM public.polls p
    WHERE p.id = p_poll_id
      AND p.track = 'system'
  )
  AND NOT public.poll_allows_public_aggregate(p_poll_id) THEN
    RETURN jsonb_build_object('hasVoted', false);
  END IF;

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

REVOKE ALL ON FUNCTION public.cast_poll_vote(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_poll_vote(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_poll_vote(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_poll_vote(uuid, uuid) TO service_role;

COMMIT;

-- ---------------------------------------------------------------------------
-- Dry-run verification (run manually after apply; do not execute in CI migrate)
-- ---------------------------------------------------------------------------
-- SET ROLE anon;
-- SELECT track, count(*) FROM public.polls GROUP BY track ORDER BY track;
-- RESET ROLE;
-- SET ROLE service_role;
-- SELECT track, count(*) FROM public.polls GROUP BY track ORDER BY track;
-- RESET ROLE;
