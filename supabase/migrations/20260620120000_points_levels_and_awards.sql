-- Points for reel votes/discuss clicks; always-visible points default.

UPDATE public.users
SET show_points = true
WHERE show_points IS DISTINCT FROM true;

CREATE OR REPLACE FUNCTION public.award_points_for_forum_prompt_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.award_user_points(
    NEW.user_id,
    2,
    'forum_prompt_vote',
    'forum_prompt',
    'prompt-vote:' || NEW.user_id::text || ':' || NEW.prompt_id::text,
    NEW.prompt_id
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_points_for_forum_prompt_vote ON public.forum_prompt_votes;
CREATE TRIGGER trg_award_points_for_forum_prompt_vote
AFTER INSERT ON public.forum_prompt_votes
FOR EACH ROW
EXECUTE FUNCTION public.award_points_for_forum_prompt_vote();

CREATE OR REPLACE FUNCTION public.award_points_for_forum_prompt_discuss()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.award_user_points(
    NEW.user_id,
    1,
    'forum_prompt_discuss',
    'forum_prompt',
    'prompt-discuss:' || NEW.user_id::text || ':' || NEW.prompt_id::text,
    NEW.prompt_id
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_award_points_for_forum_prompt_discuss ON public.forum_prompt_discuss_clicks;
CREATE TRIGGER trg_award_points_for_forum_prompt_discuss
AFTER INSERT ON public.forum_prompt_discuss_clicks
FOR EACH ROW
EXECUTE FUNCTION public.award_points_for_forum_prompt_discuss();

REVOKE ALL ON FUNCTION public.award_points_for_forum_prompt_vote() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_points_for_forum_prompt_discuss() FROM PUBLIC, anon, authenticated;
