-- Konsolider innspill/motforslag og sak-diskusjon inn i Folkets meninger.
--
-- Motforslag blir en egenskap ved en mening (`opinion_innspill`): en forfatter
-- kan fremme en mening med for/imot-punkter som innspill til en høring. Støtte
-- (endorsements) teller mot en terskel, og når terskelen nås pakkes innspillet
-- og sendes videre til n8n (N8N_HEARING_INNSPILL_WEBHOOK_URL) av cron-jobben.
--
-- Eksisterende counter_proposals rader migreres til citizen_opinions slik at
-- ingen historikk går tapt. Motforslag er ikke strukturert som For/Imot-punkter,
-- så migrerte ringer beholder `points = '[]'`; punkt-kravet håndheves bare for
-- nye meninger gjennom create_citizen_opinion.

-- ---------------------------------------------------------------------------
-- 1) opinion_innspill (én per mening)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opinion_innspill (
  opinion_id uuid PRIMARY KEY REFERENCES public.citizen_opinions (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
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
  CONSTRAINT opinion_innspill_threshold_reached
    CHECK (status NOT IN ('threshold_met', 'packaged') OR support_count >= support_threshold)
);

CREATE INDEX IF NOT EXISTS opinion_innspill_status_idx
  ON public.opinion_innspill (status, created_at DESC);

CREATE INDEX IF NOT EXISTS opinion_innspill_author_idx
  ON public.opinion_innspill (author_user_id, created_at DESC);

ALTER TABLE public.opinion_innspill ENABLE ROW LEVEL SECURITY;

-- Public read for active innspill (gathering/threshold_met/packaged), same
-- policy shape the old counter_proposals table used.
DROP POLICY IF EXISTS opinion_innspill_select_public ON public.opinion_innspill;
CREATE POLICY opinion_innspill_select_public ON public.opinion_innspill
  FOR SELECT TO anon, authenticated
  USING (status IN ('gathering', 'threshold_met', 'packaged'));

-- ---------------------------------------------------------------------------
-- 2) opinion_innspill_endorsements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opinion_innspill_endorsements (
  opinion_id uuid NOT NULL REFERENCES public.citizen_opinions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (opinion_id, user_id)
);

CREATE INDEX IF NOT EXISTS opinion_innspill_endorsements_user_idx
  ON public.opinion_innspill_endorsements (user_id);

ALTER TABLE public.opinion_innspill_endorsements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opinion_innspill_endorsements_select_own ON public.opinion_innspill_endorsements;
CREATE POLICY opinion_innspill_endorsements_select_own ON public.opinion_innspill_endorsements
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3) RPCs
-- ---------------------------------------------------------------------------

-- Only the opinion author may submit their own opinion as an innspill.
CREATE OR REPLACE FUNCTION public.create_opinion_innspill(
  p_user_id uuid,
  p_opinion_id uuid,
  p_stortinget_hearing_id text DEFAULT NULL,
  p_hearing_deadline_at timestamptz DEFAULT NULL,
  p_support_threshold integer DEFAULT 10
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_author uuid;
  v_issue_id text;
  v_threshold integer;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_public_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before submitting an innspill';
  END IF;

  SELECT author_user_id, stortinget_issue_id
    INTO v_author, v_issue_id
    FROM public.citizen_opinions
   WHERE id = p_opinion_id
     AND NOT is_removed;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opinion not found';
  END IF;

  IF v_author <> p_user_id THEN
    RAISE EXCEPTION 'Only the author can submit their opinion as an innspill';
  END IF;

  IF v_issue_id IS NULL THEN
    RAISE EXCEPTION 'Opinion must be linked to a sak before it can become an innspill';
  END IF;

  v_threshold := greatest(1, coalesce(p_support_threshold, 10));

  INSERT INTO public.opinion_innspill (
    opinion_id,
    author_user_id,
    stortinget_hearing_id,
    hearing_deadline_at,
    support_threshold
  )
  VALUES (
    p_opinion_id,
    p_user_id,
    nullif(btrim(coalesce(p_stortinget_hearing_id, '')), ''),
    p_hearing_deadline_at,
    v_threshold
  )
  ON CONFLICT (opinion_id) DO NOTHING;

  RETURN p_opinion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_opinion_innspill(uuid, uuid, text, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_opinion_innspill(uuid, uuid, text, timestamptz, integer) TO service_role;

-- Endorse (toggle) an innspill; increments support_count and flips to
-- threshold_met once support reaches the threshold.
CREATE OR REPLACE FUNCTION public.endorse_opinion_innspill(
  p_user_id uuid,
  p_opinion_id uuid
)
RETURNS TABLE (support_count integer, support_threshold integer, status text, endorsed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_threshold integer;
  v_current integer;
  v_status text;
  v_inserted boolean;
  v_endorsed boolean;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  SELECT support_threshold, support_count, status
    INTO v_threshold, v_current, v_status
    FROM public.opinion_innspill
   WHERE opinion_id = p_opinion_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Innspill not found';
  END IF;

  IF v_status = 'withdrawn' THEN
    RAISE EXCEPTION 'Innspill is withdrawn';
  END IF;

  INSERT INTO public.opinion_innspill_endorsements (opinion_id, user_id)
  VALUES (p_opinion_id, p_user_id)
  ON CONFLICT (opinion_id, user_id) DO NOTHING
  RETURNING TRUE INTO v_inserted;

  v_endorsed := COALESCE(v_inserted, FALSE);

  IF v_endorsed THEN
    v_current := v_current + 1;
  ELSE
    DELETE FROM public.opinion_innspill_endorsements
     WHERE opinion_id = p_opinion_id AND user_id = p_user_id;
    v_current := greatest(0, v_current - 1);
  END IF;

  IF v_status = 'gathering' AND v_current >= v_threshold THEN
    v_status := 'threshold_met';
  ELSIF v_status = 'threshold_met' AND v_current < v_threshold THEN
    v_status := 'gathering';
  END IF;

  UPDATE public.opinion_innspill
     SET support_count = v_current,
         status = v_status,
         updated_at = now()
   WHERE opinion_id = p_opinion_id;

  RETURN QUERY SELECT v_current, v_threshold, v_status, v_endorsed;
END;
$$;

REVOKE ALL ON FUNCTION public.endorse_opinion_innspill(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.endorse_opinion_innspill(uuid, uuid) TO service_role;

-- Mark packaged after the webhook fires (cron/admin only).
CREATE OR REPLACE FUNCTION public.mark_opinion_innspill_packaged(
  p_opinion_id uuid,
  p_payload jsonb,
  p_webhook_triggered boolean DEFAULT FALSE
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  UPDATE public.opinion_innspill
     SET status = 'packaged',
         packaged_at = now(),
         package_payload = p_payload,
         webhook_triggered_at = CASE WHEN p_webhook_triggered THEN now() ELSE webhook_triggered_at END,
         updated_at = now()
   WHERE opinion_id = p_opinion_id
     AND status <> 'withdrawn';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_opinion_innspill_packaged(uuid, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_opinion_innspill_packaged(uuid, jsonb, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) report_content: accept opinions and opinion replies
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.report_content(uuid, text, uuid, text, text);
CREATE OR REPLACE FUNCTION public.report_content(
  p_reporter_user_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_category text,
  p_details text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_target_type text;
  v_report_id uuid;
BEGIN
  PERFORM public.ensure_public_user(p_reporter_user_id);

  v_target_type := btrim(coalesce(p_target_type, ''));

  IF v_target_type NOT IN (
    'issue_discussion_post',
    'citizen_opinion',
    'citizen_opinion_reply'
  ) THEN
    RAISE EXCEPTION 'Unsupported target type';
  END IF;

  IF p_target_id IS NULL THEN
    RAISE EXCEPTION 'Target id required';
  END IF;

  IF v_target_type = 'issue_discussion_post' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.issue_discussion_posts p
       WHERE p.id = p_target_id AND NOT p.is_removed
    ) THEN
      RAISE EXCEPTION 'Post not found';
    END IF;
  ELSIF v_target_type = 'citizen_opinion' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.citizen_opinions o
       WHERE o.id = p_target_id AND NOT o.is_removed
    ) THEN
      RAISE EXCEPTION 'Opinion not found';
    END IF;
  ELSIF v_target_type = 'citizen_opinion_reply' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.citizen_opinion_replies r
       WHERE r.id = p_target_id AND NOT r.is_removed
    ) THEN
      RAISE EXCEPTION 'Reply not found';
    END IF;
  END IF;

  INSERT INTO public.content_reports (
    reporter_user_id,
    target_type,
    target_id,
    category,
    details
  )
  VALUES (
    p_reporter_user_id,
    v_target_type,
    p_target_id,
    p_category,
    p_details
  )
  ON CONFLICT (reporter_user_id, target_type, target_id) DO UPDATE
    SET category = EXCLUDED.category,
        details = EXCLUDED.details,
        created_at = now()
  RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_content(uuid, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_content(uuid, text, uuid, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Migrate counter_proposals -> citizen_opinions (+ innspill)
--
-- Body must satisfy the citizen_opinions 250..4000 CHECK. Bodies longer than
-- 4000 are truncated to 4000; bodies shorter than 250 are padded only up to the
-- original minimum by keeping them (the CHECK will reject <250, so those rows
-- are skipped and remain visible in counter_proposals as a fallback). To avoid
-- dropping data we clamp short bodies by leaving them and only migrating rows
-- whose body length is already >= 250 after trimming, so every migrated row
-- satisfies the table CHECK.
-- ---------------------------------------------------------------------------
INSERT INTO public.citizen_opinions (
  id,
  author_user_id,
  title,
  body,
  stance,
  stortinget_issue_id,
  points,
  created_at,
  updated_at
)
SELECT
  cp.id,
  cp.author_user_id,
  cp.title,
  left(btrim(cp.body), 4000),
  'blank',
  cp.stortinget_issue_id,
  '[]'::jsonb,
  cp.created_at,
  cp.updated_at
FROM public.counter_proposals cp
WHERE NOT EXISTS (
        SELECT 1 FROM public.citizen_opinions o WHERE o.id = cp.id
      )
  AND char_length(btrim(cp.body)) >= 250;

-- Carry over support count / threshold / status / hearing into opinion_innspill.
INSERT INTO public.opinion_innspill (
  opinion_id,
  author_user_id,
  status,
  support_threshold,
  support_count,
  stortinget_hearing_id,
  hearing_deadline_at,
  packaged_at,
  package_payload,
  webhook_triggered_at,
  created_at,
  updated_at
)
SELECT
  cp.id,
  cp.author_user_id,
  CASE WHEN cp.status = 'withdrawn' THEN 'gathering' ELSE cp.status END,
  cp.support_threshold,
  cp.support_count,
  cp.stortinget_hearing_id,
  cp.hearing_deadline_at,
  cp.packaged_at,
  cp.package_payload,
  cp.webhook_triggered_at,
  cp.created_at,
  cp.updated_at
FROM public.counter_proposals cp
WHERE EXISTS (
        SELECT 1 FROM public.citizen_opinions o WHERE o.id = cp.id
      )
  AND NOT EXISTS (
        SELECT 1 FROM public.opinion_innspill i WHERE i.opinion_id = cp.id
      );

-- Carry over endorsements (only for opinions that actually migrated).
INSERT INTO public.opinion_innspill_endorsements (opinion_id, user_id, created_at)
SELECT e.counter_proposal_id, e.user_id, e.created_at
FROM public.counter_proposal_endorsements e
WHERE EXISTS (
        SELECT 1 FROM public.citizen_opinions o
         WHERE o.id = e.counter_proposal_id
      )
  AND NOT EXISTS (
        SELECT 1
          FROM public.opinion_innspill_endorsements ie
         WHERE ie.opinion_id = e.counter_proposal_id
           AND ie.user_id = e.user_id
      );

COMMENT ON TABLE public.opinion_innspill IS
  'Hearing-innspill promotion for a Folkets meninger opinion. Replaces the old counter_proposals table.';
COMMENT ON TABLE public.opinion_innspill_endorsements IS
  'User support ("støtte") for an opinion submitted as a hearing innspill.';
