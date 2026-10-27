-- CI: n8n_backfill_db_pressure slot auto-detect + WAL cap defaults

DO $$
DECLARE
  v_fn oid;
  v_args text;
  v_pressure jsonb;
  v_override jsonb;
  v_test_slot text := 'cainophile_ci_pressure_test';
BEGIN
  SELECT p.oid
  INTO v_fn
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'n8n_backfill_db_pressure'
    AND pg_get_function_identity_arguments(p.oid) = 'p_slot_name text, p_max_slot_lag_bytes bigint, p_max_wal_bytes bigint';

  IF v_fn IS NULL THEN
    RAISE NOTICE 'n8n_backfill_db_pressure.sql: hopper over (migrasjon 27090000 ikke kjørt)';
    RETURN;
  END IF;

  v_args := pg_get_function_arguments(v_fn);
  IF (SELECT count(*) FROM regexp_matches(v_args, '3221225472', 'g')) < 2 THEN
    RAISE EXCEPTION 'forventet 3 GiB (3221225472) default på slot-lag og WAL, fikk: %', v_args;
  END IF;

  IF v_args LIKE '%4294967296%' THEN
    RAISE EXCEPTION '4 GiB default (4294967296) skal ikke brukes (max_slot_wal_keep_size): %', v_args;
  END IF;

  IF v_args LIKE '%cainophile_vlftkp89%' THEN
    RAISE EXCEPTION 'hardkodet cainophile_vlftkp89 skal ikke være i defaults: %', v_args;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = v_test_slot) THEN
    PERFORM pg_drop_replication_slot(v_test_slot);
  END IF;

  v_pressure := public.n8n_backfill_db_pressure();
  IF coalesce((v_pressure->>'slot_lag_bytes')::bigint, -1) <> 0 THEN
    RAISE EXCEPTION 'uten målt slot skal slot_lag_bytes være 0: %', v_pressure;
  END IF;

  IF (v_pressure->>'pause_recommended')::boolean
     AND coalesce((v_pressure->>'slot_lag_bytes')::bigint, 0) = 0
     AND coalesce((v_pressure->>'wal_bytes')::bigint, 0) <= 3221225472 THEN
    RAISE EXCEPTION 'pause skal ikke skyldes slot når slot_lag er 0 og WAL under cap: %', v_pressure;
  END IF;

  PERFORM pg_create_logical_replication_slot(v_test_slot, 'pgoutput');

  v_pressure := public.n8n_backfill_db_pressure();
  IF v_pressure->>'slot_name' IS DISTINCT FROM v_test_slot THEN
    RAISE EXCEPTION 'auto-detect skal måle cainophile_* slot, fikk: %', v_pressure;
  END IF;

  v_override := public.n8n_backfill_db_pressure('cainophile_does_not_exist');
  IF v_override->>'slot_name' = 'cainophile_does_not_exist' THEN
    RAISE EXCEPTION 'manglende override-slot skal ikke returnere 0 med echo av navnet: %', v_override;
  END IF;

  IF v_override->>'slot_name' IS DISTINCT FROM v_test_slot THEN
    RAISE EXCEPTION 'override til ikke-eksisterende slot skal falle tilbake til auto-detect: %', v_override;
  END IF;

  IF (v_override->>'slot_lag_bytes') IS DISTINCT FROM (v_pressure->>'slot_lag_bytes') THEN
    RAISE EXCEPTION 'fallback skal gi samme slot_lag som auto-detect: override=% base=%',
      v_override, v_pressure;
  END IF;

  PERFORM pg_drop_replication_slot(v_test_slot);

  IF NOT has_function_privilege('service_role', 'public.n8n_backfill_db_pressure(text, bigint, bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role mangler EXECUTE på n8n_backfill_db_pressure';
  END IF;

  IF has_function_privilege('anon', 'public.n8n_backfill_db_pressure(text, bigint, bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon skal ikke kjøre n8n_backfill_db_pressure';
  END IF;

  RAISE NOTICE 'n8n_backfill_db_pressure.sql: ok';
END $$;
