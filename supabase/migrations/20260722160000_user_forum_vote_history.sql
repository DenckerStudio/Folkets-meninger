-- Forum ja/nei vote history for profile and valgomat.

CREATE OR REPLACE FUNCTION public.get_user_forum_vote_history(p_user_id uuid)
RETURNS TABLE (
  prompt_id uuid,
  option_id text,
  voted_at timestamptz,
  question text,
  stortinget_issue_id text,
  sak_title text,
  topic_tags text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT
    fpv.prompt_id,
    fpv.option_id,
    fpv.created_at AS voted_at,
    fp.question,
    fp.stortinget_issue_id,
    si.title AS sak_title,
    coalesce(fp.topic_tags, '{}'::text[]) AS topic_tags
  FROM public.forum_prompt_votes fpv
  INNER JOIN public.forum_prompts fp ON fp.id = fpv.prompt_id
  LEFT JOIN public.stortinget_issues si ON si.id = fp.stortinget_issue_id
  WHERE fpv.user_id = p_user_id
  ORDER BY fpv.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_user_forum_vote_history(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_forum_vote_history(uuid) TO service_role;
