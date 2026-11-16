-- Selvbetjent GDPR-sletting: fjern koblinger og PII; anonyme aggregater (citizen_votes, poll_votes) beholdes.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.delete_my_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $function$
BEGIN
  PERFORM public.assert_rpc_caller_is_user(p_user_id);

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin'
  ) AND (
    SELECT count(*)::int FROM public.user_roles WHERE role = 'admin'
  ) = 1 THEN
    RAISE EXCEPTION 'Cannot delete the last admin account';
  END IF;

  PERFORM public.purge_political_processing_data(p_user_id);

  DELETE FROM public.user_political_consents WHERE user_id = p_user_id;

  DELETE FROM public.admin_audit_log WHERE actor_id = p_user_id;

  DELETE FROM public.site_feedback WHERE user_id = p_user_id;

  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    UPDATE public.analytics_events
    SET metadata = metadata - 'user_id' - 'userId'
    WHERE metadata->>'user_id' = p_user_id::text
       OR metadata->>'userId' = p_user_id::text;
  END IF;

  IF to_regclass('public.action_clusters') IS NOT NULL THEN
    UPDATE public.action_clusters SET decided_by = NULL WHERE decided_by = p_user_id;
  END IF;

  IF to_regclass('public.research_topics') IS NOT NULL THEN
    UPDATE public.research_topics SET created_by = NULL WHERE created_by = p_user_id;
  END IF;

  IF to_regclass('public.research_briefs') IS NOT NULL THEN
    UPDATE public.research_briefs SET requested_by = NULL WHERE requested_by = p_user_id;
  END IF;

  IF to_regclass('public.dev_task_proposals') IS NOT NULL THEN
    UPDATE public.dev_task_proposals SET decided_by = NULL WHERE decided_by = p_user_id;
  END IF;

  IF to_regclass('public.content_feedback') IS NOT NULL THEN
    UPDATE public.content_feedback SET admin_id = NULL WHERE admin_id = p_user_id;
  END IF;

  IF to_regclass('public.polls') IS NOT NULL THEN
    UPDATE public.polls SET created_by = NULL WHERE created_by = p_user_id;
  END IF;

  IF to_regclass('public.app_roadmap_items') IS NOT NULL THEN
    UPDATE public.app_roadmap_items SET created_by = NULL WHERE created_by = p_user_id;
  END IF;

  IF to_regclass('public.app_changelog_entries') IS NOT NULL THEN
    UPDATE public.app_changelog_entries SET created_by = NULL WHERE created_by = p_user_id;
  END IF;

  IF to_regclass('public.app_suggestions') IS NOT NULL THEN
    UPDATE public.app_suggestions SET handled_by = NULL WHERE handled_by = p_user_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_my_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account(uuid) TO service_role;

COMMIT;