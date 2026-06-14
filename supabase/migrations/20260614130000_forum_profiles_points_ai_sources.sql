-- Forum moderation, activity points, public profile fields, and richer AI summary sources

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS party_preference text,
  ADD COLUMN IF NOT EXISTS profile_is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_party_preference boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_points boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.forum_threads
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('approved', 'rejected', 'hidden')),
  ADD COLUMN IF NOT EXISTS moderation_category text,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz;

ALTER TABLE public.forum_replies
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('approved', 'rejected', 'hidden')),
  ADD COLUMN IF NOT EXISTS moderation_category text,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz;

CREATE INDEX IF NOT EXISTS forum_threads_moderation_status_idx
  ON public.forum_threads (moderation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS forum_replies_moderation_status_idx
  ON public.forum_replies (moderation_status, created_at DESC);

DROP POLICY IF EXISTS forum_threads_select ON public.forum_threads;
CREATE POLICY forum_threads_select
  ON public.forum_threads
  FOR SELECT TO anon, authenticated
  USING (moderation_status = 'approved');

DROP POLICY IF EXISTS forum_replies_select ON public.forum_replies;
CREATE POLICY forum_replies_select
  ON public.forum_replies
  FOR SELECT TO anon, authenticated
  USING (moderation_status = 'approved');

ALTER TABLE public.stortinget_issues
  ADD COLUMN IF NOT EXISTS ai_summary_source_context text,
  ADD COLUMN IF NOT EXISTS ai_summary_source_json jsonb,
  ADD COLUMN IF NOT EXISTS ai_summary_source_hash text,
  ADD COLUMN IF NOT EXISTS ai_summary_source_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.stortinget_issue_documents (
  issue_id text NOT NULL REFERENCES public.stortinget_issues (id) ON DELETE CASCADE,
  document_id text NOT NULL,
  title text,
  document_type text,
  text_excerpt text,
  source_url text,
  content_hash text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, document_id)
);

ALTER TABLE public.stortinget_issue_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stortinget_issue_documents_select_all ON public.stortinget_issue_documents;
CREATE POLICY stortinget_issue_documents_select_all
  ON public.stortinget_issue_documents
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.user_points_balances (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  ref_type text NOT NULL,
  ref_id uuid,
  ref_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reason, ref_key)
);

CREATE INDEX IF NOT EXISTS user_points_ledger_user_created_idx
  ON public.user_points_ledger (user_id, created_at DESC);

ALTER TABLE public.user_points_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_points_balances_select ON public.user_points_balances;
CREATE POLICY user_points_balances_select
  ON public.user_points_balances
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS user_points_ledger_select_own ON public.user_points_ledger;
CREATE POLICY user_points_ledger_select_own
  ON public.user_points_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.award_user_points(
  p_user_id uuid,
  p_delta integer,
  p_reason text,
  p_ref_type text,
  p_ref_key text,
  p_ref_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_delta = 0 OR p_ref_key IS NULL OR btrim(p_ref_key) = '' THEN
    RETURN false;
  END IF;

  WITH inserted AS (
    INSERT INTO public.user_points_ledger (user_id, delta, reason, ref_type, ref_key, ref_id)
    VALUES (p_user_id, p_delta, p_reason, p_ref_type, p_ref_key, p_ref_id)
    ON CONFLICT (user_id, reason, ref_key) DO NOTHING
    RETURNING user_id, delta
  ),
  upserted AS (
    INSERT INTO public.user_points_balances (user_id, points, updated_at)
    SELECT user_id, delta, now()
    FROM inserted
    ON CONFLICT (user_id) DO UPDATE SET
      points = public.user_points_balances.points + EXCLUDED.points,
      updated_at = now()
    RETURNING true
  )
  SELECT EXISTS (SELECT 1 FROM upserted) INTO v_inserted;

  RETURN v_inserted;
END;
$function$;

REVOKE ALL ON FUNCTION public.award_user_points(uuid, integer, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_user_points(uuid, integer, text, text, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.forum_moderation_check(p_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_text text := lower(coalesce(p_text, ''));
BEGIN
  IF btrim(v_text) = '' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'other', 'reason', 'Innholdet kan ikke være tomt');
  END IF;

  IF v_text ~ '(nazi|heil hitler|white power|jødesvin|jødehat|jævla[[:space:]]+(neger|jævel)|drep[[:space:]]+(alle|dem|innvandrere))' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'hate', 'reason', 'Innlegget bryter retningslinjene for respektfull debatt');
  END IF;

  IF v_text ~ '((rase|religion|legning|funksjonshemmede)[[:space:]]+(burde|skal)[[:space:]]+(ut|fjernes|nektes)|(alle|ingen)[[:space:]]+(muslimer|jøder|homofile|transpersoner|romfolk)[[:space:]]+(er|bør|skal)|(send|kast)[[:space:]]+(dem|alle)[[:space:]]+ut)' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'discrimination', 'reason', 'Diskriminerende generaliseringer er ikke tillatt');
  END IF;

  IF v_text ~ '(porno|pornhub|xnxx|xvideos|onlyfans|sex[[:space:]]*video|erotisk[[:space:]]+film)' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'sexual', 'reason', 'Eksplisitt eller upassende innhold er ikke tillatt');
  END IF;

  IF v_text ~ '((drep|skyt|henrett)[[:space:]]+(ham|henne|dem|alle)|bank[[:space:]]+opp[[:space:]]+(ham|henne|dem|alle)|(bombe|terror|massakre)[[:space:]]+(stortinget|regjeringen|politikere|dem))' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'violence', 'reason', 'Oppfordringer til vold er ikke tillatt');
  END IF;

  IF v_text ~ '(kjøp[[:space:]]+nå|gratis[[:space:]]+penger|crypto[[:space:]]+giveaway)' THEN
    RETURN jsonb_build_object('approved', false, 'category', 'spam', 'reason', 'Innlegget ser ut som spam');
  END IF;

  RETURN jsonb_build_object('approved', true, 'category', null, 'reason', null);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_forum_thread(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_stortinget_issue_id text DEFAULT NULL,
  p_context_items jsonb DEFAULT '[]'::jsonb,
  p_is_system_thread boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_thread_id uuid;
  v_title text;
  v_body text;
  v_moderation jsonb;
BEGIN
  IF NOT COALESCE(p_is_system_thread, false) THEN
    PERFORM public.ensure_public_user(p_user_id);
    IF NOT public.user_has_forum_identity(p_user_id) THEN
      RAISE EXCEPTION 'Complete your profile with first and last name before posting';
    END IF;
  END IF;

  v_title := btrim(p_title);
  v_body := btrim(p_body);

  IF char_length(v_title) < 3 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'Title must be between 3 and 200 characters';
  END IF;

  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  v_moderation := public.forum_moderation_check(v_title || E'\n' || v_body);
  IF NOT COALESCE((v_moderation->>'approved')::boolean, false) THEN
    RAISE EXCEPTION 'MODERATION_REJECTED:%', v_moderation->>'reason';
  END IF;

  IF p_stortinget_issue_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.stortinget_issues WHERE id = p_stortinget_issue_id
  ) THEN
    RAISE EXCEPTION 'Unknown stortinget issue';
  END IF;

  INSERT INTO public.forum_threads (
    title, body, stortinget_issue_id, author_user_id, context_items, is_system_thread,
    moderation_status, moderation_category, moderation_reason, moderated_at
  )
  VALUES (
    v_title, v_body, p_stortinget_issue_id, p_user_id,
    COALESCE(p_context_items, '[]'::jsonb),
    COALESCE(p_is_system_thread, false),
    'approved', v_moderation->>'category', v_moderation->>'reason', now()
  )
  RETURNING id INTO v_thread_id;

  RETURN v_thread_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_forum_reply(
  p_user_id uuid,
  p_thread_id uuid,
  p_body text,
  p_parent_reply_id uuid DEFAULT NULL,
  p_is_official_response boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_reply_id uuid;
  v_body text;
  v_is_official boolean;
  v_moderation jsonb;
BEGIN
  PERFORM public.ensure_public_user(p_user_id);

  IF NOT public.user_has_forum_identity(p_user_id) THEN
    RAISE EXCEPTION 'Complete your profile with first and last name before posting';
  END IF;

  IF p_parent_reply_id IS NOT NULL THEN
    RAISE EXCEPTION 'Nested replies are not supported';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.forum_threads
    WHERE id = p_thread_id AND moderation_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  v_body := btrim(p_body);

  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN
    RAISE EXCEPTION 'Body must be between 1 and 10000 characters';
  END IF;

  v_moderation := public.forum_moderation_check(v_body);
  IF NOT COALESCE((v_moderation->>'approved')::boolean, false) THEN
    RAISE EXCEPTION 'MODERATION_REJECTED:%', v_moderation->>'reason';
  END IF;

  v_is_official := COALESCE(p_is_official_response, false);

  IF v_is_official AND NOT EXISTS (
    SELECT 1 FROM public.politician_profiles WHERE user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Only verified politicians can post official responses';
  END IF;

  INSERT INTO public.forum_replies (
    thread_id, body, author_user_id, parent_reply_id, is_official_response,
    moderation_status, moderation_category, moderation_reason, moderated_at
  )
  VALUES (
    p_thread_id, v_body, p_user_id, NULL, v_is_official,
    'approved', v_moderation->>'category', v_moderation->>'reason', now()
  )
  RETURNING id INTO v_reply_id;

  IF v_is_official THEN
    UPDATE public.forum_threads
    SET is_resolved = true
    WHERE id = p_thread_id;
  END IF;

  RETURN v_reply_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.award_points_for_forum_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.author_user_id IS NOT NULL
    AND NEW.is_system_thread = false
    AND NEW.moderation_status = 'approved' THEN
    PERFORM public.award_user_points(
      NEW.author_user_id, 10, 'forum_thread_created', 'forum_thread', 'thread:' || NEW.id::text, NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_points_for_forum_thread ON public.forum_threads;
CREATE TRIGGER trg_award_points_for_forum_thread
AFTER INSERT ON public.forum_threads
FOR EACH ROW
EXECUTE FUNCTION public.award_points_for_forum_thread();

CREATE OR REPLACE FUNCTION public.award_points_for_forum_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.author_user_id IS NOT NULL AND NEW.moderation_status = 'approved' THEN
    PERFORM public.award_user_points(
      NEW.author_user_id, 5, 'forum_reply_created', 'forum_reply', 'reply:' || NEW.id::text, NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_points_for_forum_reply ON public.forum_replies;
CREATE TRIGGER trg_award_points_for_forum_reply
AFTER INSERT ON public.forum_replies
FOR EACH ROW
EXECUTE FUNCTION public.award_points_for_forum_reply();

CREATE OR REPLACE FUNCTION public.award_points_for_forum_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_author_id uuid;
BEGIN
  PERFORM public.award_user_points(
    NEW.user_id, 1, 'forum_like_given', 'forum_like', 'like-given:' || NEW.user_id::text || ':' || NEW.target_type || ':' || NEW.target_id::text, NEW.target_id
  );

  IF NEW.target_type = 'thread' THEN
    SELECT author_user_id INTO v_author_id
    FROM public.forum_threads
    WHERE id = NEW.target_id AND moderation_status = 'approved';
  ELSE
    SELECT author_user_id INTO v_author_id
    FROM public.forum_replies
    WHERE id = NEW.target_id AND moderation_status = 'approved';
  END IF;

  IF v_author_id IS NOT NULL AND v_author_id <> NEW.user_id THEN
    PERFORM public.award_user_points(
      v_author_id, 2, 'forum_like_received', NEW.target_type,
      'like-received:' || NEW.user_id::text || ':' || NEW.target_type || ':' || NEW.target_id::text,
      NEW.target_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_points_for_forum_like ON public.forum_likes;
CREATE TRIGGER trg_award_points_for_forum_like
AFTER INSERT ON public.forum_likes
FOR EACH ROW
EXECUTE FUNCTION public.award_points_for_forum_like();

CREATE OR REPLACE FUNCTION public.award_points_for_vote_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.ensure_public_user(NEW.user_id);
  PERFORM public.award_user_points(
    NEW.user_id, 3, 'vote_cast', 'stortinget_issue',
    'vote:' || NEW.user_id::text || ':' || NEW.stortinget_issue_id,
    NULL
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_points_for_vote_receipt ON public.user_vote_receipts;
CREATE TRIGGER trg_award_points_for_vote_receipt
AFTER INSERT ON public.user_vote_receipts
FOR EACH ROW
EXECUTE FUNCTION public.award_points_for_vote_receipt();
