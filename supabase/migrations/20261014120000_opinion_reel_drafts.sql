-- B6: admin-triggered system Reel drafts derived from popular citizen opinions.
-- The resulting draft is clearly marked as user-initiated (generation_metadata)
-- and links back to the source opinion via source_opinion_id.

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS source_opinion_id uuid
  REFERENCES public.citizen_opinions (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.polls.source_opinion_id IS
  'Set when a system Reel draft was opened by an admin from a citizen opinion (B6).';

CREATE INDEX IF NOT EXISTS polls_source_opinion_idx
  ON public.polls (source_opinion_id)
  WHERE source_opinion_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_poll_draft_from_opinion(
  p_opinion_id uuid,
  p_title text,
  p_neutral_summary text DEFAULT '',
  p_source_urls jsonb DEFAULT '[]'::jsonb,
  p_generation_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_poll_id uuid;
  v_issue_id text;
  v_title text;
BEGIN
  IF p_opinion_id IS NULL THEN
    RAISE EXCEPTION 'Missing opinion id';
  END IF;

  SELECT stortinget_issue_id
  INTO v_issue_id
  FROM public.citizen_opinions
  WHERE id = p_opinion_id
    AND is_removed = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opinion not found';
  END IF;

  IF v_issue_id IS NULL OR btrim(v_issue_id) = '' THEN
    RAISE EXCEPTION 'Opinion is not linked to an issue';
  END IF;

  v_title := nullif(btrim(coalesce(p_title, '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Missing title';
  END IF;

  -- One Reel per issue (matches polls_stortinget_issue_uidx).
  IF EXISTS (
    SELECT 1
    FROM public.polls
    WHERE stortinget_issue_id = btrim(v_issue_id)
      AND status IN ('draft', 'open', 'closed')
  ) THEN
    RAISE EXCEPTION 'Poll already exists for issue';
  END IF;

  INSERT INTO public.polls (
    track,
    status,
    title,
    neutral_summary,
    source_urls,
    stortinget_issue_id,
    source_opinion_id,
    generation_metadata
  )
  VALUES (
    'system',
    'draft',
    v_title,
    coalesce(btrim(p_neutral_summary), ''),
    coalesce(p_source_urls, '[]'::jsonb),
    btrim(v_issue_id),
    p_opinion_id,
    coalesce(p_generation_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_poll_id;

  RETURN v_poll_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_poll_draft_from_opinion(uuid,text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_poll_draft_from_opinion(uuid,text,text,jsonb,jsonb) TO service_role;
