-- System-generated Reels as polls (ja/nei/blank), draft → admin publish.

ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS generation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.polls
  DROP CONSTRAINT IF EXISTS polls_track_check;

ALTER TABLE public.polls
  ADD CONSTRAINT polls_track_check
  CHECK (track IN ('stortinget', 'citizen', 'system'));

COMMENT ON COLUMN public.polls.generation_metadata IS
  'n8n/Ollama pipeline metadata for system reels (source_type, confidence, rag chunks).';

DROP INDEX IF EXISTS public.polls_stortinget_issue_uidx;
CREATE UNIQUE INDEX polls_stortinget_issue_uidx
  ON public.polls (stortinget_issue_id)
  WHERE stortinget_issue_id IS NOT NULL
    AND status IN ('draft', 'open', 'closed');

CREATE OR REPLACE FUNCTION public.create_system_poll_draft(
  p_issue_id text,
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
  v_title text;
BEGIN
  v_title := nullif(btrim(coalesce(p_title, '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Missing title';
  END IF;

  IF p_issue_id IS NOT NULL AND btrim(p_issue_id) <> '' THEN
    INSERT INTO public.stortinget_issues (id, title, summary, last_synced_at)
    VALUES (
      btrim(p_issue_id),
      v_title,
      nullif(btrim(coalesce(p_neutral_summary, '')), ''),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      last_synced_at = now();

    SELECT id INTO v_poll_id
    FROM public.polls
    WHERE stortinget_issue_id = btrim(p_issue_id)
      AND status IN ('draft', 'open', 'closed')
    LIMIT 1;

    IF v_poll_id IS NOT NULL THEN
      RAISE EXCEPTION 'Poll already exists for issue';
    END IF;
  END IF;

  INSERT INTO public.polls (
    track,
    status,
    title,
    neutral_summary,
    source_urls,
    stortinget_issue_id,
    generation_metadata
  )
  VALUES (
    'system',
    'draft',
    v_title,
    coalesce(btrim(p_neutral_summary), ''),
    coalesce(p_source_urls, '[]'::jsonb),
    nullif(btrim(coalesce(p_issue_id, '')), ''),
    coalesce(p_generation_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_poll_id;

  RETURN v_poll_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_poll(p_poll_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_poll_id IS NULL THEN
    RAISE EXCEPTION 'Missing poll id';
  END IF;

  SELECT status INTO v_status
  FROM public.polls
  WHERE id = p_poll_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Poll is not a draft';
  END IF;

  UPDATE public.polls
  SET
    status = 'open',
    opens_at = coalesce(opens_at, now()),
    updated_at = now()
  WHERE id = p_poll_id;

  RETURN p_poll_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_poll(p_poll_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_poll_id IS NULL THEN
    RAISE EXCEPTION 'Missing poll id';
  END IF;

  SELECT status INTO v_status
  FROM public.polls
  WHERE id = p_poll_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;
  IF v_status NOT IN ('draft', 'open') THEN
    RAISE EXCEPTION 'Poll cannot be archived';
  END IF;

  UPDATE public.polls
  SET
    status = 'archived',
    updated_at = now()
  WHERE id = p_poll_id;

  RETURN p_poll_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sak_poll_coverage()
RETURNS TABLE (
  pending_issues bigint,
  pending_with_rag bigint,
  pending_with_poll bigint,
  sak_candidates bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
          FROM public.polls p
          WHERE p.stortinget_issue_id = i.id
            AND p.status IN ('draft', 'open', 'closed')
        )
    ) AS pending_with_poll,
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
          FROM public.polls p
          WHERE p.stortinget_issue_id = i.id
            AND p.status IN ('draft', 'open', 'closed')
        )
    ) AS sak_candidates
  FROM public.stortinget_issues i;
$$;

CREATE OR REPLACE FUNCTION public.get_sak_poll_candidates(p_limit int DEFAULT 25)
RETURNS TABLE (
  issue_id text,
  title text,
  summary text,
  last_updated_at timestamptz,
  rag_chunk_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id AS issue_id,
    i.title,
    i.summary,
    i.last_updated_at,
    (
      SELECT count(*)::bigint
      FROM public.document_chunks dc
      WHERE dc.issue_id = i.id
        AND dc.embedding_status = 'ready'
    ) AS rag_chunk_count
  FROM public.stortinget_issues i
  WHERE i.status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.document_chunks dc
      WHERE dc.issue_id = i.id
        AND dc.embedding_status = 'ready'
        AND dc.embedding IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.polls p
      WHERE p.stortinget_issue_id = i.id
        AND p.status IN ('draft', 'open', 'closed')
    )
  ORDER BY i.last_updated_at DESC NULLS LAST, i.first_seen_at ASC
  LIMIT greatest(1, least(coalesce(p_limit, 25), 50));
$$;

REVOKE ALL ON FUNCTION public.create_system_poll_draft(text, text, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_poll(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_poll(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_sak_poll_coverage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_sak_poll_candidates(int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_system_poll_draft(text, text, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_poll(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_poll(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_sak_poll_coverage() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_sak_poll_candidates(int) TO service_role;
