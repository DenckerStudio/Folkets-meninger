-- Integrasjonstest: dev_task_proposals grants, RLS, constraints.
DO $$
DECLARE
  v_admin_id uuid := 'd1111111-1111-4111-8111-111111111101';
  v_user_id uuid := 'd2222222-2222-4222-8222-222222222202';
  v_proposal_id uuid;
  v_count int;
  v_instance_id uuid;
BEGIN
  IF to_regclass('public.dev_task_proposals') IS NULL THEN
    RAISE EXCEPTION 'dev_task_proposals.sql: forventet tabell dev_task_proposals';
  END IF;

  IF has_table_privilege('anon', 'public.dev_task_proposals', 'SELECT') THEN
    RAISE EXCEPTION 'anon skal ikke ha SELECT på dev_task_proposals';
  END IF;
  IF has_table_privilege('anon', 'public.dev_task_proposals', 'INSERT,UPDATE,DELETE,TRUNCATE') THEN
    RAISE EXCEPTION 'anon skal ikke ha skrivetilgang på dev_task_proposals';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.dev_task_proposals', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated mangler SELECT på dev_task_proposals';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.dev_task_proposals', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated mangler INSERT på dev_task_proposals';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.dev_task_proposals', 'INSERT') THEN
    RAISE EXCEPTION 'service_role mangler INSERT på dev_task_proposals';
  END IF;

  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION 'dev_task_proposals.sql: auth.instances mangler (forventet fra supabase start)';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    v_instance_id,
    v_admin_id,
    'authenticated',
    'authenticated',
    'ci-dev-task-admin@folkets-meninger.test',
    '$2a$10$PznFIrLXp7kIyf2uABqafeNHEMakoAameoJrJJx7qH6xwfdEecy12',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_admin_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.dev_task_proposals WHERE dedupe_key LIKE 'ci-dev-task-%';

  SET LOCAL ROLE service_role;
  INSERT INTO public.dev_task_proposals (title, source, dedupe_key, status)
  VALUES ('CI test', 'ci', 'ci-dev-task-seed', 'til_godkjenning')
  RETURNING id INTO v_proposal_id;
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM public.dev_task_proposals;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'ikke-admin authenticated skal se 0 rader, fant %', v_count;
  END IF;

  BEGIN
    INSERT INTO public.dev_task_proposals (title, source, dedupe_key)
    VALUES ('Skal feile', 'ci', 'ci-dev-task-denied');
    RAISE EXCEPTION 'ikke-admin INSERT skulle feile';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%row-level security%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    UPDATE public.dev_task_proposals SET status = 'avslatt' WHERE id = v_proposal_id;
    RAISE EXCEPTION 'ikke-admin UPDATE skulle feile';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%row-level security%' THEN
        RAISE;
      END IF;
  END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM public.dev_task_proposals;
  IF v_count < 1 THEN
    RAISE EXCEPTION 'admin skal se minst én rad, fant %', v_count;
  END IF;

  UPDATE public.dev_task_proposals
  SET status = 'i_prosess', decided_by = v_admin_id, decided_at = now()
  WHERE id = v_proposal_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.dev_task_proposals
    WHERE id = v_proposal_id AND status = 'i_prosess'
  ) THEN
    RAISE EXCEPTION 'admin UPDATE av status feilet';
  END IF;
  RESET ROLE;

  SET LOCAL ROLE service_role;
  BEGIN
    INSERT INTO public.dev_task_proposals (title, source, dedupe_key)
    VALUES ('Dup', 'ci', 'ci-dev-task-seed');
    RAISE EXCEPTION 'duplikat dedupe_key skulle feile';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO public.dev_task_proposals (title, source, dedupe_key, status)
    VALUES ('Bad status', 'ci', 'ci-dev-task-bad-status', 'ugyldig');
    RAISE EXCEPTION 'ugyldig status skulle feile';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO public.dev_task_proposals (title, source, dedupe_key, risk)
    VALUES ('Bad risk', 'ci', 'ci-dev-task-bad-risk', 'høy');
    RAISE EXCEPTION 'ugyldig risk skulle feile';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  UPDATE public.dev_task_proposals
  SET
    slack_ts = '1234567890.123456',
    slack_posted_at = now(),
    status = 'i_prosess'
  WHERE id = v_proposal_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dev_task_proposals
    WHERE id = v_proposal_id
      AND slack_ts = '1234567890.123456'
      AND slack_posted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'service_role skulle kunne skrive slack_ts og slack_posted_at';
  END IF;

  RESET ROLE;

  DELETE FROM public.dev_task_proposals WHERE dedupe_key LIKE 'ci-dev-task-%';
  DELETE FROM public.user_roles WHERE user_id = v_admin_id AND role = 'admin';
  DELETE FROM auth.users WHERE id = v_admin_id;

  RAISE NOTICE 'dev_task_proposals.sql: OK';
END $$;
