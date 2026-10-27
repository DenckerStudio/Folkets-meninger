-- Idempotent setup for Logflare / Cainophile WAL heartbeat on self-hosted Supabase.
-- Target database: _supabase (NOT the app `postgres` DB). Do NOT place under supabase/migrations.
-- Coolify Expert applies manually after Mathias approves. See docs/ops/logflare-wal-heartbeat.md.

\set ON_ERROR_STOP on

CREATE TABLE IF NOT EXISTS _analytics.wal_heartbeat (
  id smallint PRIMARY KEY,
  beat_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO _analytics.wal_heartbeat (id, beat_at)
VALUES (1, now())
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'logflare_pub'
      AND schemaname = '_analytics'
      AND tablename = 'wal_heartbeat'
  ) THEN
    ALTER PUBLICATION logflare_pub ADD TABLE _analytics.wal_heartbeat;
  END IF;
END
$$;

REVOKE ALL ON TABLE _analytics.wal_heartbeat FROM PUBLIC;
REVOKE ALL ON TABLE _analytics.wal_heartbeat FROM anon;
REVOKE ALL ON TABLE _analytics.wal_heartbeat FROM authenticated;
