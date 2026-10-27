-- Soft-expiry for system Reels drafts awaiting admin approval (72h default via n8n job).

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

COMMENT ON COLUMN public.polls.expired_at IS
  'Satt når et system-utkast utløper uten admin-vurdering (status utløpt).';

ALTER TABLE public.polls
  DROP CONSTRAINT IF EXISTS polls_status_check;

ALTER TABLE public.polls
  ADD CONSTRAINT polls_status_check
  CHECK (status IN ('draft', 'open', 'closed', 'archived', 'utløpt'));

ALTER TABLE public.polls
  DROP CONSTRAINT IF EXISTS polls_expired_at_pair_check;

ALTER TABLE public.polls
  ADD CONSTRAINT polls_expired_at_pair_check
  CHECK (
    (status = 'utløpt' AND expired_at IS NOT NULL)
    OR (status <> 'utløpt' AND expired_at IS NULL)
  );

CREATE OR REPLACE FUNCTION public.n8n_expire_stale_reel_drafts(
  p_dry_run boolean DEFAULT false,
  p_max_age interval DEFAULT interval '72 hours'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_max_age IS NULL OR p_max_age <= interval '0' THEN
    RAISE EXCEPTION 'p_max_age must be positive';
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.polls p
  WHERE p.track = 'system'
    AND p.status = 'draft'
    AND p.created_at < now() - p_max_age;

  IF p_dry_run OR v_count = 0 THEN
    RETURN v_count;
  END IF;

  UPDATE public.polls
  SET
    status = 'utløpt',
    expired_at = now(),
    updated_at = now()
  WHERE track = 'system'
    AND status = 'draft'
    AND created_at < now() - p_max_age;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_expired_reel_draft(
  p_admin_user_id uuid,
  p_poll_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_track text;
BEGIN
  PERFORM public.require_admin_user_id(p_admin_user_id);

  IF p_poll_id IS NULL THEN
    RAISE EXCEPTION 'Missing poll id';
  END IF;

  SELECT status, track INTO v_status, v_track
  FROM public.polls
  WHERE id = p_poll_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;

  IF v_track <> 'system' THEN
    RAISE EXCEPTION 'Poll is not a system reel draft';
  END IF;

  IF v_status <> 'utløpt' THEN
    RAISE EXCEPTION 'Poll is not expired';
  END IF;

  UPDATE public.polls
  SET
    status = 'draft',
    expired_at = NULL,
    updated_at = now()
  WHERE id = p_poll_id;

  RETURN p_poll_id;
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_expire_stale_reel_drafts(boolean, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_expire_stale_reel_drafts(boolean, interval) TO service_role;

REVOKE ALL ON FUNCTION public.admin_restore_expired_reel_draft(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_expired_reel_draft(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
