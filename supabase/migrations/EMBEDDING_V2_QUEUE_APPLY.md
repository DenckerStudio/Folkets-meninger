# Embedding v2 queue + backfill leases (PR #207) — production apply

**Coolify Expert applies manually** after Mathias approves. There is **no** `schema_migrations` ledger on prod — track applied files in your ops log.

**Hard dependency:** PR **#185** RAG stack **phase A + phase B** complete (`20261022100000`–`22109600` transactional, `20261022109000`–`22109500` concurrent indexes valid). Requires `document_chunks.embedding_v2`, `embedding_v2_status`, and `save_embeddings_v2` from `20261022103000`.

**Repo branch:** `cursor/embedding-v2-queue-de5b` (stacked on `cursor/rag-improve-drastisk-5738`).

## Files and order (do not reorder)

| Step | File | Type | Purpose |
| --- | --- | --- | --- |
| 1 | `20261026110100_embedding_v2_queue_and_gates.sql` | Transactional | Queue RPCs, tier helpers, P6/P7 `fm_chunk_has_usable_embedding` gates |
| 2 | `20261026110200_embedding_backlog_health_perf.sql` | Transactional | Faster `n8n_embedding_backlog_health` |
| 3 | `20261026110300_embedding_v2_chunk_leases.sql` | Transactional | `embedding_v2_claimed_*` columns (metadata-only), `n8n_claim_chunks_missing_v2`, `save_embeddings_v2` lease checks |
| 4 | `20261026110000_document_chunks_v2_pending_issue_idx_concurrent.sql` | **CONCURRENTLY** | Partial index on pending v2 chunks per issue |
| 5 | `20261026110400_n8n_claim_chunks_missing_v2_perf.sql` | Transactional | Set-based issue tiers for `n8n_claim_chunks_missing_v2` (fixes 15s statement timeout at ~380k pending) |
| 6 | `20261027090000_n8n_backfill_db_pressure_slot_fix.sql` | Transactional | Auto-detect Realtime `cainophile_*` replication slot lag; default slot-lag and WAL pause at **3 GiB** (below `max_slot_wal_keep_size`) |

**Apply order is fixed:** transactional steps **1 → 2 → 3 → 5 → 6**, then concurrent step **4** (do not run `26110000` before `26110300`). Step **5** requires step **3** (lease RPC). Step **6** replaces `n8n_backfill_db_pressure` from step **1** — run after **5** (or any time after **1** if claim perf is already applied). After step 3, claim/save RPCs exist for backfill #206; step 4 can still build while backfill runs, but Coolify should follow this sequence.

Each transactional file is its own `psql -f` with phase-A session settings (see below); do not merge 1–3 into one transaction unless you accept all-or-nothing rollback.

CI (`scripts/run-prod-like-db-security.sh`) applies **1–3**, **5**, **6**, then **4** in that order.

## Maintenance window

| Phase | Files | Pause n8n document ingest / embedding? | Duration |
| --- | --- | --- | --- |
| **Transactional** | `26110100`, `26110200`, `26110300` | **Yes** — avoid competing writes on `document_chunks` during RPC deploy | **~2–5 min** (lease columns: metadata-only, sub-second lock) |
| **Concurrent index** | `26110000` | **Recommended** — same rationale as #185 phase B | **~5–20 min** typical on ~380k pending rows (IO-bound) |

Pause workflows: `dokument-embeddings` (legacy), pipeline catch-up that writes chunks, and **Coolify one-off** `scripts/backfill-embedding-v2.ts` until verification passes.

## Phase A — transactional session settings

Before **each** transactional file (steps 1–3, 5, and 6):

```sql
SET lock_timeout = '30s';
SET statement_timeout = '10min';
```

```bash
export PGOPTIONS='-c lock_timeout=30s -c statement_timeout=10min'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261026110100_embedding_v2_queue_and_gates.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261026110200_embedding_backlog_health_perf.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261026110300_embedding_v2_chunk_leases.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261026110400_n8n_claim_chunks_missing_v2_perf.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261027090000_n8n_backfill_db_pressure_slot_fix.sql
```

### Backfill DB pressure (`27090000`)

Dry-run after apply (read-only; no writes):

```sql
BEGIN;
SET LOCAL ROLE service_role;
SELECT * FROM n8n_backfill_db_pressure();
ROLLBACK;
```

Expect `slot_name` to name the **measured** Realtime slot (auto-detected `cainophile_*` when present), not a stale hardcoded name. Default `p_max_wal_bytes` is **3 GiB** (`3221225472`).

On self-hosted Supabase the function owner may be `supabase_admin`; `CREATE OR REPLACE` as the migration role is fine as long as grants stay `service_role` only.

### Claim perf (`26110400`)

Transactional only (no new indexes). After apply, verify claim latency in a rolled-back transaction:

```sql
BEGIN;
SET LOCAL ROLE service_role;
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM n8n_claim_chunks_missing_v2('background', 2, 'diag', 60);
ROLLBACK;
```

Expect no per-row `fm_embedding_v2_issue_tier` in the plan; runtime should stay well under prod `statement_timeout` (15s).

### Lease columns (`26110300`)

- `embedding_v2_claimed_at timestamptz NULL`
- `embedding_v2_claimed_by text NULL`
- **No DEFAULT** — avoids rewrite on ~380k-row `document_chunks`.

Verify after step 3:

```sql
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'document_chunks'
  AND column_name IN ('embedding_v2_claimed_at', 'embedding_v2_claimed_by');
```

Expect `YES` nullable and `column_default` **NULL**.

**Rollback (transactional):** only if migration failed before `COMMIT`. After success, rollback = restore snapshot / PITR. Do not drop lease columns in production without a planned window.

## Phase B — concurrent index (step 4)

**One file = one `psql` session.** Do **not** wrap in `BEGIN`/`COMMIT`.

```sql
SET lock_timeout = '30s';
SET statement_timeout = 0;
SET maintenance_work_mem = '1GB';
SET max_parallel_maintenance_workers = 0;
```

```bash
export PGOPTIONS='-c lock_timeout=30s -c statement_timeout=0 -c maintenance_work_mem=1GB -c max_parallel_maintenance_workers=0'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261026110000_document_chunks_v2_pending_issue_idx_concurrent.sql
```

### After step 4 — invalid-index check

```sql
SET lock_timeout = '30s';
SET statement_timeout = '10min';

SELECT c.relname AS index_name, i.indisvalid
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_class t ON t.oid = i.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'document_chunks_v2_pending_issue_idx'
  AND NOT i.indisvalid;
```

- **Expected:** zero rows.
- **If invalid:** `DROP INDEX CONCURRENTLY IF EXISTS public.document_chunks_v2_pending_issue_idx;` then re-run step 4 with `statement_timeout = 0`.

**Rollback per index:** `DROP INDEX CONCURRENTLY IF EXISTS public.document_chunks_v2_pending_issue_idx;`

## Verification (after all steps)

```sql
-- RPCs exist (service_role only)
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'n8n_claim_chunks_missing_v2',
    'n8n_release_embedding_v2_claims',
    'n8n_list_v2_priority_issues',
    'n8n_embedding_backlog_health'
  );

-- Index valid
SELECT c.relname, i.indisvalid
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname = 'document_chunks_v2_pending_issue_idx';
```

Optional SQL tests (CI parity):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/embedding_v2_queue_rpcs.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/embedding_backlog_health_explain.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/embedding_v2_claim_leases.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/n8n_backfill_db_pressure.sql
```

## App / n8n follow-up (not in SQL migrations)

- Publish updated `pipeline-health` / `document-embeddings` workflow sources from PR #207 (legacy embedding retry gated by `N8N_RETRY_LEGACY_EMBEDDINGS=false`).
- Run **PR #206** backfill (`scripts/backfill-embedding-v2.ts`) with claim RPCs after this apply.

## Related

- RAG prerequisites: [`RAG_PROD_APPLY_RUNBOOK.md`](./RAG_PROD_APPLY_RUNBOOK.md)
- Backfill script README: repo root `README.md` § embedding_v2 backfill
