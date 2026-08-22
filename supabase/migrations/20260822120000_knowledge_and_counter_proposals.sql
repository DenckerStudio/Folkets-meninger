-- Knowledge gamification (quiz/document reads/badges) + sak motforslag.
-- Points reuse award_user_points. No Typebot dependency; quizzes are in-app.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 1. Knowledge activity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_knowledge_quiz_passes (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  stortinget_issue_id text NOT NULL,
  score integer NOT NULL CHECK (score >= 0),
  total integer NOT NULL CHECK (total > 0),
  passed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, stortinget_issue_id)
);

CREATE INDEX IF NOT EXISTS user_knowledge_quiz_passes_issue_idx
  ON public.user_knowledge_quiz_passes (stortinget_issue_id);

ALTER TABLE public.user_knowledge_quiz_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_knowledge_quiz_passes_select_own ON public.user_knowledge_quiz_passes;
CREATE POLICY user_knowledge_quiz_passes_select_own ON public.user_knowledge_quiz_passes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_document_reads (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  stortinget_issue_id text NOT NULL,
  document_id text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, stortinget_issue_id, document_id)
);

CREATE INDEX IF NOT EXISTS user_document_reads_user_idx
  ON public.user_document_reads (user_id, read_at DESC);

ALTER TABLE public.user_document_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_document_reads_select_own ON public.user_document_reads;
CREATE POLICY user_document_reads_select_own ON public.user_document_reads
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  badge_id text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS user_badges_badge_idx ON public.user_badges (badge_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_badges_select_public ON public.user_badges;
CREATE POLICY user_badges_select_public ON public.user_badges
  FOR SELECT TO anon, authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 2. Motforslag (counter-proposals attached to a Stortinget sak)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.counter_proposals (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  stortinget_issue_id text NOT NULL,
  author_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'gathering'
    CHECK (status IN ('gathering', 'threshold_met', 'packaged', 'withdrawn')),
  support_threshold integer NOT NULL DEFAULT 10 CHECK (support_threshold > 0),
  support_count integer NOT NULL DEFAULT 0 CHECK (support_count >= 0),
  stortinget_hearing_id text,
  hearing_deadline_at timestamptz,
  packaged_at timestamptz,
  package_payload jsonb,
  webhook_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT counter_proposals_title_len CHECK (char_length(btrim(title)) BETWEEN 5 AND 200),
  CONSTRAINT counter_proposals_body_len CHECK (char_length(btrim(body)) BETWEEN 40 AND 8000)
);

CREATE UNIQUE INDEX IF NOT EXISTS counter_proposals_author_issue_uidx
  ON public.counter_proposals (author_user_id, stortinget_issue_id)
  WHERE status <> 'withdrawn';

CREATE INDEX IF NOT EXISTS counter_proposals_issue_idx
  ON public.counter_proposals (stortinget_issue_id, support_count DESC);

CREATE INDEX IF NOT EXISTS counter_proposals_status_idx
  ON public.counter_proposals (status, created_at DESC);

ALTER TABLE public.counter_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS counter_proposals_select_public ON public.counter_proposals;
CREATE POLICY counter_proposals_select_public ON public.counter_proposals
  FOR SELECT TO anon, authenticated
  USING (status IN ('gathering', 'threshold_met', 'packaged'));

CREATE TABLE IF NOT EXISTS public.counter_proposal_endorsements (
  counter_proposal_id uuid NOT NULL REFERENCES public.counter_proposals (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (counter_proposal_id, user_id)
);

CREATE INDEX IF NOT EXISTS counter_proposal_endorsements_user_idx
  ON public.counter_proposal_endorsements (user_id);

ALTER TABLE public.counter_proposal_endorsements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS counter_proposal_endorsements_select_own ON public.counter_proposal_endorsements;
CREATE POLICY counter_proposal_endorsements_select_own ON public.counter_proposal_endorsements
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_counter_proposal(
  p_user_id uuid,
  p_stortinget_issue_id text,
  p_title text,
  p_body text,
  p_stortinget_hearing_id text DEFAULT NULL,
  p_hearing_deadline_at timestamptz DEFAULT NULL,
  p_support_threshold integer DEFAULT 10
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id uuid;
  v_title text := btrim(p_title);
  v_body text := btrim(p_body);
  v_issue text := btrim(p_stortinget_issue_id);
  v_threshold integer := coalesce(p_support_threshold, 10);
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_public_identity(p_user_id) THEN
    RAISE EXCEPTION 'Public identity required';
  END IF;

  IF v_issue IS NULL OR v_issue = '' THEN
    RAISE EXCEPTION 'Missing issue id';
  END IF;

  IF char_length(v_title) < 5 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 5 and 200 characters';
  END IF;

  IF char_length(v_body) < 40 OR char_length(v_body) > 8000 THEN
    RAISE EXCEPTION 'Body must be between 40 and 8000 characters';
  END IF;

  IF v_threshold < 2 THEN
    v_threshold := 2;
  END IF;

  INSERT INTO public.counter_proposals (
    stortinget_issue_id,
    author_user_id,
    title,
    body,
    support_threshold,
    support_count,
    stortinget_hearing_id,
    hearing_deadline_at
  )
  VALUES (
    v_issue,
    p_user_id,
    v_title,
    v_body,
    v_threshold,
    1,
    nullif(btrim(coalesce(p_stortinget_hearing_id, '')), ''),
    p_hearing_deadline_at
  )
  RETURNING id INTO v_id;

  INSERT INTO public.counter_proposal_endorsements (counter_proposal_id, user_id)
  VALUES (v_id, p_user_id);

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.endorse_counter_proposal(
  p_user_id uuid,
  p_counter_proposal_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row public.counter_proposals%ROWTYPE;
  v_count integer;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  SELECT * INTO v_row
  FROM public.counter_proposals
  WHERE id = p_counter_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Counter proposal not found';
  END IF;

  IF v_row.status NOT IN ('gathering', 'threshold_met') THEN
    RAISE EXCEPTION 'Counter proposal not open for endorsements';
  END IF;

  INSERT INTO public.counter_proposal_endorsements (counter_proposal_id, user_id)
  VALUES (p_counter_proposal_id, p_user_id)
  ON CONFLICT DO NOTHING;

  SELECT count(*)::integer INTO v_count
  FROM public.counter_proposal_endorsements
  WHERE counter_proposal_id = p_counter_proposal_id;

  UPDATE public.counter_proposals
  SET
    support_count = v_count,
    status = CASE
      WHEN v_count >= support_threshold AND status = 'gathering' THEN 'threshold_met'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_counter_proposal_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'counterProposalId', v_row.id,
    'supportCount', v_row.support_count,
    'supportThreshold', v_row.support_threshold,
    'status', v_row.status,
    'endorsed', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_counter_proposal_packaged(
  p_counter_proposal_id uuid,
  p_payload jsonb,
  p_webhook_triggered boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.counter_proposals
  SET
    status = 'packaged',
    packaged_at = now(),
    package_payload = p_payload,
    webhook_triggered_at = CASE
      WHEN p_webhook_triggered THEN now()
      ELSE webhook_triggered_at
    END,
    updated_at = now()
  WHERE id = p_counter_proposal_id
    AND status IN ('gathering', 'threshold_met', 'packaged')
    AND support_count >= support_threshold;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.create_counter_proposal(uuid, text, text, text, text, timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.endorse_counter_proposal(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_counter_proposal_packaged(uuid, jsonb, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_counter_proposal(uuid, text, text, text, text, timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.endorse_counter_proposal(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_counter_proposal_packaged(uuid, jsonb, boolean) TO service_role;
