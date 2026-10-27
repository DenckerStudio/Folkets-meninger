-- TRANSACTIONAL. Fix n8n_backfill_db_pressure: auto-detect Realtime cainophile_* slots, 3 GiB WAL cap.
BEGIN;

CREATE OR REPLACE FUNCTION public.n8n_backfill_db_pressure(
  p_slot_name text DEFAULT NULL,
  p_max_slot_lag_bytes bigint DEFAULT 4294967296,
  p_max_wal_bytes bigint DEFAULT 3221225472
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_override text := nullif(btrim(p_slot_name), '');
  v_measured_slot text;
  v_slot_lag bigint := 0;
  v_wal_bytes bigint;
BEGIN
  IF v_override IS NOT NULL THEN
    SELECT
      s.slot_name,
      coalesce(pg_wal_lsn_diff(pg_current_wal_lsn(), s.restart_lsn), 0)
    INTO v_measured_slot, v_slot_lag
    FROM pg_replication_slots AS s
    WHERE s.slot_name = v_override
    LIMIT 1;
  END IF;

  IF v_measured_slot IS NULL THEN
    SELECT
      ranked.slot_name,
      ranked.lag_bytes
    INTO v_measured_slot, v_slot_lag
    FROM (
      SELECT
        s.slot_name,
        coalesce(pg_wal_lsn_diff(pg_current_wal_lsn(), s.restart_lsn), 0) AS lag_bytes
      FROM pg_replication_slots AS s
      WHERE s.active IS TRUE
        AND s.slot_type = 'logical'
        AND (
          s.slot_name LIKE 'cainophile\_%' ESCAPE '\'
          OR NOT EXISTS (
            SELECT 1
            FROM pg_replication_slots AS c
            WHERE c.active IS TRUE
              AND c.slot_type = 'logical'
              AND c.slot_name LIKE 'cainophile\_%' ESCAPE '\'
          )
        )
      ORDER BY 2 DESC
      LIMIT 1
    ) AS ranked;

    v_slot_lag := coalesce(v_slot_lag, 0);
  END IF;

  SELECT coalesce(
    (SELECT sum(size) FROM pg_ls_waldir()),
    0
  )
  INTO v_wal_bytes;

  RETURN jsonb_build_object(
    'slot_name', v_measured_slot,
    'slot_lag_bytes', v_slot_lag,
    'wal_bytes', v_wal_bytes,
    'pause_recommended', v_slot_lag > p_max_slot_lag_bytes OR v_wal_bytes > p_max_wal_bytes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.n8n_backfill_db_pressure(text, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.n8n_backfill_db_pressure(text, bigint, bigint) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
