# Logflare / Cainophile replication slot — WAL heartbeat (Coolify `supabase-folkets`)

**Coolify Expert applies manually** on the DB host after Mathias approves. This is **not** an app-database migration: it runs against the internal Postgres database **`_supabase`** (Logflare / `supabase-analytics`), not `postgres`. **Do not** add files under `supabase/migrations` for this change.

This runbook matches what was applied on **prod (2026-10-27)** — use it for new environments and as the rollback reference.

**Related app guard:** `n8n_backfill_db_pressure` (migration `20261027090000`) pauses embedding v2 backfill when Realtime slot lag or WAL size exceeds **3 GiB**. That guard limits damage but does not fix the root cause described here. See [`EMBEDDING_V2_QUEUE_APPLY.md`](../../supabase/migrations/EMBEDDING_V2_QUEUE_APPLY.md) § step 6.

### Observed result (prod, 2026-10-27)

After SQL, cron, and a one-time **supabase-analytics** restart, slot lag fell from about **1.5 GB** to about **50–60 MB** within minutes, and **`confirmed_flush_lsn`** began advancing with each cron tick.

## Problem

Self-hosted **supabase-analytics** (`supabase/logflare:1.31.2`, `LOGFLARE_SUPABASE_MODE=true`) uses Cainophile logical replication against database **`_supabase`**. It creates a slot named `cainophile_<random>` subscribed to publication **`logflare_pub`**.

`logflare_pub` only includes a small set of `_analytics` configuration tables (~10 tiny tables). Under normal operation those tables rarely change, so the logical subscriber **almost never receives row changes**. Postgres therefore keeps **`confirmed_flush_lsn` stuck at `restart_lsn`**: the slot does not advance its confirmed position even though the **application database** (`postgres`) generates large WAL (e.g. embedding v2 backfill at roughly **2 GB/hour**).

With **`max_slot_wal_keep_size = 4GB`**, WAL retained for the stale slot eventually exceeds the limit and the slot is **invalidated**, breaking analytics and risking operational surprise. Lowering `max_slot_wal_keep_size` while lag is already high **invalidates slots irreversibly** — **keep it at 4GB** until the heartbeat has been healthy for at least **24 hours** (revisit tuning only after that).

### Why `pg_logical_emit_message` keepalive does not help

Ops and upstream have tried logical decoding keepalive messages. Cainophile’s `pgoutput` consumer **does not request generic logical messages**, so periodic `pg_logical_emit_message` calls do not move **`confirmed_flush_lsn`**. This is tracked upstream as [Logflare issue #4075](https://github.com/Logflare/logflare/issues/4075) (still open through at least v1.54.0); version bumps and env toggles alone do not fix it on self-hosted stacks.

## Agreed fix (ops-approved)

1. **Backup** `_supabase` schema before changes (method used on prod below).
2. Create **`_analytics.wal_heartbeat`**: single row, `id int PRIMARY KEY`, `ts timestamptz NOT NULL DEFAULT now()`.
3. Add the table to publication **`logflare_pub`** (idempotent in repo SQL; prod also used a plain `ALTER PUBLICATION … ADD TABLE` when run manually).
4. **Revoke** access from `PUBLIC`, `anon`, and `authenticated` — only **`supabase_admin`** retains access on prod.
5. **Host cron** (`/etc/cron.d/logflare-heartbeat`) updates `ts` every minute.
6. **Restart** `supabase-analytics` once after setup.
7. **Verify** slot lag and `confirmed_flush_lsn` movement; keep **`max_slot_wal_keep_size = 4GB`**.

Optional idempotent SQL file: [`sql/logflare-wal-heartbeat.sql`](./sql/logflare-wal-heartbeat.sql).

## Gotchas

1. **`cainophile_*` slot names change** on every Logflare reconnect or **supabase-analytics** restart (prod e.g. `cainophile_v3qw67o9` → `cainophile_6vjauso7`). Never hardcode a slot name; always filter `slot_name LIKE 'cainophile\_%' ESCAPE '\'`.
2. After any **Logflare / supabase-analytics upgrade**, confirm `pg_publication_tables` still lists `_analytics.wal_heartbeat` on **`logflare_pub`**. Re-add with `ALTER PUBLICATION logflare_pub ADD TABLE _analytics.wal_heartbeat` if it is missing.
3. Remove any legacy **`pg_logical_emit_message` keepalive cron** — it does **not** move `confirmed_flush_lsn` and can confuse ops.

## Prerequisites

- Shell access on the host that runs the Supabase Postgres container (Coolify **`supabase-folkets`** stack).
- A maintenance note in the ops log (no fm-web deploy required).
- Connect as **`supabase_admin`** on database **`_supabase`**, not `postgres`:

```bash
docker exec -it <SUPABASE_DB_CONTAINER> psql -U supabase_admin -d _supabase -v ON_ERROR_STOP=1
```

```sql
SELECT current_database(), current_user;
```

## Step 0 — Backup

**Method used on prod** — schema-only dump via `docker exec` on the DB host:

```bash
export SUPABASE_DB_CONTAINER='<SUPABASE_DB_CONTAINER>'
export OPS_BACKUP_DIR='<OPS_BACKUP_DIR>'
export BACKUP_TS='<YYYYMMDD-HHMMSS>'
mkdir -p "$OPS_BACKUP_DIR"
docker exec "$SUPABASE_DB_CONTAINER" pg_dump -U supabase_admin -d _supabase --schema-only \
  > "$OPS_BACKUP_DIR/pre-walhb-${BACKUP_TS}-supabase-schema.sql"
```

Keep the file until heartbeat has been stable for 24h+.

**Optional alternative** — `_analytics` custom-format dump (heavier; useful if you need data restore):

```bash
docker exec "$SUPABASE_DB_CONTAINER" pg_dump -U supabase_admin -d _supabase -n _analytics -Fc \
  -f /tmp/_supabase_analytics_pre_wal_heartbeat.dump
docker cp "$SUPABASE_DB_CONTAINER:/tmp/_supabase_analytics_pre_wal_heartbeat.dump" \
  "$OPS_BACKUP_DIR/_supabase_analytics_pre_wal_heartbeat.dump"
```

## Step 1 — Setup SQL (idempotent)

```bash
export SUPABASE_DB_CONTAINER='<SUPABASE_DB_CONTAINER>'
docker exec -i "$SUPABASE_DB_CONTAINER" psql -U supabase_admin -d _supabase -v ON_ERROR_STOP=1 \
  < docs/ops/sql/logflare-wal-heartbeat.sql
```

Or paste from [`sql/logflare-wal-heartbeat.sql`](./sql/logflare-wal-heartbeat.sql). Seed on prod:

```sql
INSERT INTO _analytics.wal_heartbeat VALUES (1, now())
ON CONFLICT (id) DO UPDATE SET ts = now();
```

**Publication:** the repo SQL uses a guarded `DO` block. On prod, ops also ran a direct:

```sql
ALTER PUBLICATION logflare_pub ADD TABLE _analytics.wal_heartbeat;
```

Either is fine if the table is not already published.

Confirm membership:

```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'logflare_pub'
  AND schemaname = '_analytics'
  AND tablename = 'wal_heartbeat';
```

Expect **one row**.

## Step 2 — Cron (every minute)

Create **`/etc/cron.d/logflare-heartbeat`** on the DB host, mode **644**:

```cron
* * * * * root docker exec <SUPABASE_DB_CONTAINER> psql -U supabase_admin -d _supabase -At -c "UPDATE _analytics.wal_heartbeat SET ts=now() WHERE id=1" >/dev/null 2>>/var/log/logflare-heartbeat.err
```

Replace `<SUPABASE_DB_CONTAINER>`. Stderr goes to `/var/log/logflare-heartbeat.err` on the host.

After **2–3 minutes**, confirm `ts` advances:

```sql
SELECT id, ts, now() - ts AS age
FROM _analytics.wal_heartbeat
WHERE id = 1;
```

Expect `age` well under **2 minutes**.

## Step 3 — Restart supabase-analytics (once)

After SQL + cron:

```bash
docker restart <SUPABASE_ANALYTICS_CONTAINER>
```

Or restart **`supabase-analytics`** once in Coolify. Do not restart the primary Postgres container unless separately planned.

## Verification

### Quick check (database `_supabase`, as `supabase_admin`)

Prod-style overview (all slots; filter mentally to `cainophile_*`):

```sql
SELECT
  slot_name,
  active,
  confirmed_flush_lsn,
  pg_size_pretty(pg_current_wal_lsn() - restart_lsn) AS restart_lag,
  wal_status
FROM pg_replication_slots;
```

Cainophile only:

```sql
SELECT
  slot_name,
  active,
  confirmed_flush_lsn,
  pg_size_pretty(pg_current_wal_lsn() - restart_lsn) AS restart_lag,
  wal_status
FROM pg_replication_slots
WHERE slot_name LIKE 'cainophile\_%' ESCAPE '\';
```

After cron and analytics restart: **`confirmed_flush_lsn`** should advance; **`restart_lag`** should stay small (prod: ~50–60 MB vs ~1.5 GB before fix).

### Detailed lag (bytes)

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

Re-run every **10–15 minutes** for an hour with embedding backfill running; lag should not climb toward 3–4 GiB.

On the app DB (`postgres`), optional cross-check:

```sql
BEGIN;
SET LOCAL ROLE service_role;
SELECT * FROM n8n_backfill_db_pressure();
ROLLBACK;
```

Expect `pause_recommended` **false** when heartbeat keeps slot lag down.

## Interim emergency guard (before or during rollout)

If slot **restart lag** exceeds **~2.5 GiB** and heartbeat is not in place, you may **terminate the Cainophile walsender**. **Never `pg_drop_replication_slot`** unless Mathias approves a full rebuild plan.

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

-- Only when restart_lag_bytes > 2684354560 (2.5 GiB):
SELECT pg_terminate_backend(r.pid)
FROM pg_replication_slots AS s
JOIN pg_stat_replication AS r ON r.slot_name = s.slot_name
WHERE s.slot_name LIKE 'cainophile\_%' ESCAPE '\'
  AND pg_wal_lsn_diff(pg_current_wal_lsn(), s.restart_lsn) > 2684354560;
```

## Rollback

1. On `_supabase` as `supabase_admin`:

```sql
ALTER PUBLICATION logflare_pub DROP TABLE _analytics.wal_heartbeat;
```

2. On the DB host:

```bash
rm /etc/cron.d/logflare-heartbeat
```

3. **Leave** `_analytics.wal_heartbeat` in place unless Mathias approves a later drop.

4. Restart **supabase-analytics** if replication does not recover.

Restore from Step 0 backup only if publication or `_analytics` schema was damaged.

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
