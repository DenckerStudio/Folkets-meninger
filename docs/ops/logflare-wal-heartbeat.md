# Logflare / Cainophile replication slot — WAL heartbeat (Coolify `supabase-folkets`)

**Coolify Expert applies manually** on the DB host after Mathias approves. This is **not** an app-database migration: it runs against the internal Postgres database **`_supabase`** (Logflare / `supabase-analytics`), not `postgres`. **Do not** add files under `supabase/migrations` for this change.

**Related app guard:** `n8n_backfill_db_pressure` (migration `20261027090000`) pauses embedding v2 backfill when Realtime slot lag or WAL size exceeds **3 GiB**. That guard limits damage but does not fix the root cause described here. See [`EMBEDDING_V2_QUEUE_APPLY.md`](../../supabase/migrations/EMBEDDING_V2_QUEUE_APPLY.md) § step 6.

## Problem

Self-hosted **supabase-analytics** (`supabase/logflare:1.31.2`, `LOGFLARE_SUPABASE_MODE=true`) uses Cainophile logical replication against database **`_supabase`**. It creates a slot named `cainophile_<random>` subscribed to publication **`logflare_pub`**.

`logflare_pub` only includes a small set of `_analytics` configuration tables (~10 tiny tables). Under normal operation those tables rarely change, so the logical subscriber **almost never receives row changes**. Postgres therefore keeps **`confirmed_flush_lsn` stuck at `restart_lsn`**: the slot does not advance its confirmed position even though the **application database** (`postgres`) generates large WAL (e.g. embedding v2 backfill at roughly **2 GB/hour**).

With **`max_slot_wal_keep_size = 4GB`**, WAL retained for the stale slot eventually exceeds the limit and the slot is **invalidated**, breaking analytics and risking operational surprise. Lowering `max_slot_wal_keep_size` while lag is already high **invalidates slots irreversibly** — **keep it at 4GB** until the heartbeat has been healthy for at least **24 hours** (revisit tuning only after that).

### Why `pg_logical_emit_message` keepalive does not help

Ops and upstream have tried logical decoding keepalive messages. Cainophile’s `pgoutput` consumer **does not request generic logical messages**, so periodic `pg_logical_emit_message` calls do not move **`confirmed_flush_lsn`**. This is tracked upstream as [Logflare issue #4075](https://github.com/Logflare/logflare/issues/4075) (still open through at least v1.54.0); version bumps and env toggles alone do not fix it on self-hosted stacks.

## Agreed fix (ops-approved)

1. **Backup** `_analytics` (or full `_supabase`) before changes.
2. Create **`_analytics.wal_heartbeat`**: single-row table, primary key `id smallint`, `beat_at timestamptz`.
3. Add the table to publication **`logflare_pub`** (idempotent).
4. **Revoke** access from `PUBLIC`, `anon`, and `authenticated` (cron uses a privileged DB role on the host).
5. **Host cron** updates `beat_at` every minute so replication sees steady changes.
6. **Restart** `supabase-analytics` once after setup so Cainophile reconnects with the new publication member.
7. **Verify** slot lag and `confirmed_flush_lsn` movement; keep **`max_slot_wal_keep_size = 4GB`** during rollout.

Optional idempotent SQL file: [`sql/logflare-wal-heartbeat.sql`](./sql/logflare-wal-heartbeat.sql).

## Prerequisites

- Shell access on the host that runs the Supabase Postgres container (Coolify **`supabase-folkets`** stack).
- A maintenance note in the ops log (no fm-web deploy required).
- Confirm you are connected to database **`_supabase`**, not `postgres`:

```sql
SELECT current_database();
```

## Step 0 — Backup

On the DB host (placeholders — adjust to your layout):

```bash
export SUPABASE_DB_CONTAINER='<SUPABASE_DB_CONTAINER>'
export BACKUP_DIR='<OPS_BACKUP_DIR>'
mkdir -p "$BACKUP_DIR"
docker exec "$SUPABASE_DB_CONTAINER" pg_dump -U postgres -d _supabase -n _analytics -Fc \
  -f /tmp/_supabase_analytics_pre_wal_heartbeat.dump
docker cp "$SUPABASE_DB_CONTAINER:/tmp/_supabase_analytics_pre_wal_heartbeat.dump" \
  "$BACKUP_DIR/_supabase_analytics_pre_wal_heartbeat.dump"
```

Keep the dump until heartbeat has been stable for 24h+.

## Step 1 — Setup SQL (idempotent)

```bash
export SUPABASE_DB_CONTAINER='<SUPABASE_DB_CONTAINER>'
docker exec -i "$SUPABASE_DB_CONTAINER" psql -U postgres -d _supabase -v ON_ERROR_STOP=1 \
  < docs/ops/sql/logflare-wal-heartbeat.sql
```

Or paste the equivalent statements from [`sql/logflare-wal-heartbeat.sql`](./sql/logflare-wal-heartbeat.sql).

Confirm publication membership:

```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'logflare_pub'
  AND schemaname = '_analytics'
  AND tablename = 'wal_heartbeat';
```

Expect **one row**.

## Step 2 — Cron (every minute)

Run on the **DB host** (not inside fm-web). Use a dedicated ops user or root crontab; do not commit connection strings or passwords.

Template:

```cron
# Logflare WAL heartbeat — updates replication-visible row in _supabase._analytics.wal_heartbeat
* * * * * docker exec -i <SUPABASE_DB_CONTAINER> psql -U postgres -d _supabase -v ON_ERROR_STOP=1 -c "UPDATE _analytics.wal_heartbeat SET beat_at = now() WHERE id = 1;" >> <OPS_CRON_LOG> 2>&1
```

Replace `<SUPABASE_DB_CONTAINER>`, `<OPS_CRON_LOG>`. If you use host `psql` instead of `docker exec`, use a **host-only** connection URI in the crontab (never store it in git).

After adding cron, wait **2–3 minutes** and confirm `beat_at` advances:

```sql
SELECT id, beat_at, now() - beat_at AS age
FROM _analytics.wal_heartbeat
WHERE id = 1;
```

Expect `age` well under **2 minutes**.

## Step 3 — Restart supabase-analytics (once)

In Coolify, restart the **`supabase-analytics`** service (Logflare container) **once** after SQL + cron are in place so the subscriber picks up `wal_heartbeat` on `logflare_pub`.

Do not restart the primary Postgres container unless separately planned.

## Verification

### Immediate (same session, database `_supabase`)

```sql
SELECT
  slot_name,
  active,
  confirmed_flush_lsn,
  restart_lsn,
  pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) AS confirm_lag_bytes,
  pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) AS restart_lag_bytes
FROM pg_replication_slots
WHERE slot_name LIKE 'cainophile\_%' ESCAPE '\';
```

After cron has run and analytics has restarted:

- **`confirmed_flush_lsn`** should **advance** over several minutes (not frozen at `restart_lsn`).
- **`confirm_lag_bytes`** should stay **far below** `max_slot_wal_keep_size` (4GB). Compare to app-side pressure RPC lag on `postgres` only after heartbeat is healthy.

### Over ~1 hour (with embedding backfill running)

Re-run the query above every **10–15 minutes**. **`restart_lag_bytes`** (and/or confirm lag) should remain **low and stable**, not climbing toward 3–4 GiB.

On the app DB (`postgres`), optional cross-check that the guard is not stuck paused:

```sql
BEGIN;
SET LOCAL ROLE service_role;
SELECT * FROM n8n_backfill_db_pressure();
ROLLBACK;
```

Expect `pause_recommended` **false** when heartbeat keeps slot lag down.

## Interim emergency guard (before or during rollout)

If slot **restart lag** exceeds **~2.5 GiB** and you cannot deploy heartbeat immediately, you may **terminate the Cainophile walsender** to stop WAL retention temporarily. **Never `pg_drop_replication_slot`** on production analytics slots unless explicitly directed by Mathias and a full rebuild plan exists.

Database **`_supabase`**:

```sql
SELECT
  s.slot_name,
  pg_wal_lsn_diff(pg_current_wal_lsn(), s.restart_lsn) AS restart_lag_bytes,
  r.pid,
  r.application_name,
  r.state
FROM pg_replication_slots AS s
LEFT JOIN pg_stat_replication AS r ON r.slot_name = s.slot_name
WHERE s.slot_name LIKE 'cainophile\_%' ESCAPE '\';

-- Only when restart_lag_bytes > 2684354560 (2.5 GiB) and ops accepts brief analytics disconnect:
SELECT pg_terminate_backend(r.pid)
FROM pg_replication_slots AS s
JOIN pg_stat_replication AS r ON r.slot_name = s.slot_name
WHERE s.slot_name LIKE 'cainophile\_%' ESCAPE '\'
  AND pg_wal_lsn_diff(pg_current_wal_lsn(), s.restart_lsn) > 2684354560;
```

Logflare will reconnect; pair with heartbeat rollout or expect lag to return.

## Rollback

1. Remove the **cron** line from the host crontab.
2. On `_supabase`:

```sql
ALTER PUBLICATION logflare_pub DROP TABLE _analytics.wal_heartbeat;
```

3. **Leave** `_analytics.wal_heartbeat` in place (harmless) unless you explicitly drop it during a later window:

```sql
-- Optional, only if Mathias approves:
-- DROP TABLE IF EXISTS _analytics.wal_heartbeat;
```

4. Restart **supabase-analytics** if replication does not recover after DROP.

Restore from Step 0 backup only if publication or analytics schema was damaged.

## `max_slot_wal_keep_size` policy

| Setting | Decision |
| --- | --- |
| **`max_slot_wal_keep_size`** | **Stay at 4GB** during heartbeat rollout. |
| Lowering below current lag | **Do not** — risks **irreversible** slot invalidation. |
| Revisit | Only after **≥ 24h** stable heartbeat with confirm LSN moving and lag low. |

## References

- App-side pause guard: `20261027090000_n8n_backfill_db_pressure_slot_fix.sql`
- Embedding apply order: [`EMBEDDING_V2_QUEUE_APPLY.md`](../../supabase/migrations/EMBEDDING_V2_QUEUE_APPLY.md)
- Upstream: [Logflare #4075](https://github.com/Logflare/logflare/issues/4075) (logical replication slot WAL retention)
