-- Fail if anon/authenticated can EXECUTE a user/actor/admin SECURITY DEFINER RPC without caller guards.

DO $$
DECLARE
  problems text[] := '{}';
  r record;
  public_safe text[] := ARRAY[
    'get_public_user_displays',
    'get_issue_vote_totals',
    'get_poll_totals',
    'get_poll_totals_by_fylke',
    'match_issue_document_chunks',
    'get_prompt_results',
    'is_admin',
    'search_stortinget_issues_for_chat',
    'search_issue_document_chunks_text',
    'check_api_rate_limit'
  ];
  def text;
  has_sensitive_param boolean;
BEGIN
  FOR r IN
    SELECT
      p.oid,
      p.oid::regprocedure AS sig,
      p.proname,
      p.proargnames,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
      has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND d.objid IS NULL
      AND p.proname NOT LIKE 'n8n\_%'
  LOOP
    IF NOT (r.auth_exec OR r.anon_exec) THEN
      CONTINUE;
    END IF;

    IF r.proname = ANY(public_safe) THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM unnest(coalesce(r.proargnames, array[]::text[])) AS a(name)
      WHERE name ILIKE '%user_id%'
         OR name ILIKE '%admin%'
         OR name ILIKE '%actor%'
         OR name ILIKE '%reporter%'
         OR name ILIKE '%granted_by%'
         OR name ILIKE '%revoked_by%'
    ) INTO has_sensitive_param;

    IF NOT has_sensitive_param THEN
      CONTINUE;
    END IF;

    def := pg_get_functiondef(r.oid);

    IF def IS NULL
       OR (
         position('assert_rpc_caller_is_user' in def) = 0
         AND position('assert_rpc_caller_is_actor' in def) = 0
         AND position('require_admin_user_id' in def) = 0
       ) THEN
      problems := problems || format(
        'anon/authenticated EXECUTE på %s uten assert_rpc_caller_is_user/assert_rpc_caller_is_actor/require_admin_user_id',
        r.sig
      );
    END IF;
  END LOOP;

  IF array_length(problems, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'security-definer-caller-guard feilet (%s funn):%s',
      array_length(problems, 1),
      chr(10) || array_to_string(problems, chr(10));
  END IF;

  RAISE NOTICE 'security-definer-caller-guard: ok';
END $$;
