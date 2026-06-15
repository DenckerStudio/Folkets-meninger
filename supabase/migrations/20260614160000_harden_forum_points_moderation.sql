-- Harden forum moderation/points functions and remove duplicate public forum read policies.

CREATE OR REPLACE FUNCTION public.forum_moderation_check(p_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
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

REVOKE ALL ON FUNCTION public.forum_moderation_check(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.forum_moderation_check(text) TO service_role;

REVOKE ALL ON FUNCTION public.award_user_points(uuid, integer, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_points_for_forum_thread() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_points_for_forum_reply() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_points_for_forum_like() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_points_for_vote_receipt() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.award_user_points(uuid, integer, text, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.create_forum_thread(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_forum_thread(uuid, text, text, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_forum_reply(uuid, uuid, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.toggle_forum_like(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_forum_thread(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_forum_thread(uuid, text, text, text, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_forum_reply(uuid, uuid, text, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.toggle_forum_like(uuid, text, uuid) TO service_role;

DROP POLICY IF EXISTS forum_threads_select_all ON public.forum_threads;
DROP POLICY IF EXISTS forum_replies_select_all ON public.forum_replies;
