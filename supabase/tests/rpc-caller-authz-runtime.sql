-- Runtime checks for assert_rpc_caller_is_user / assert_rpc_caller_is_actor and ERRCODE 42501.
-- EXECUTE on assert helpers is service_role-only; tests set JWT claims while connected as postgres.

DO $$
DECLARE
  v_user uuid := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid;
  v_other uuid := 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'::uuid;
  v_sqlstate text;
BEGIN
  -- postgres without JWT: trusted server caller
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM public.assert_rpc_caller_is_user(v_user);
  PERFORM public.assert_rpc_caller_is_actor(v_user);

  -- service_role JWT: trusted (still postgres session)
  PERFORM set_config(
    'request.jwt.claims',
    '{"role":"service_role"}',
    true
  );
  PERFORM public.assert_rpc_caller_is_user(v_other);
  PERFORM public.assert_rpc_caller_is_actor(v_other);

  -- authenticated, matching user
  PERFORM set_config(
    'request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_user),
    true
  );
  PERFORM public.assert_rpc_caller_is_user(v_user);
  PERFORM public.assert_rpc_caller_is_actor(v_user);

  -- authenticated, wrong user -> 42501
  PERFORM set_config(
    'request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_user),
    true
  );
  BEGIN
    PERFORM public.assert_rpc_caller_is_user(v_other);
    RAISE EXCEPTION 'expected forbidden for authenticated impersonation';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
      IF v_sqlstate <> '42501' THEN
        RAISE;
      END IF;
  END;

  -- anon with user id param -> 42501
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  BEGIN
    PERFORM public.assert_rpc_caller_is_user(v_user);
    RAISE EXCEPTION 'expected forbidden for anon impersonation';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
      IF v_sqlstate <> '42501' THEN
        RAISE;
      END IF;
  END;

  -- stance RPC under trusted postgres (empty claims)
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM public.get_user_stance_count(v_user);

  PERFORM set_config('request.jwt.claims', '', true);
  RAISE NOTICE 'rpc-caller-authz-runtime: ok';
END $$;
