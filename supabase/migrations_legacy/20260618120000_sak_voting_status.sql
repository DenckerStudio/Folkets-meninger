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
