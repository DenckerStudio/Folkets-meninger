# PR #185 RAG stack — production apply runbook (Coolify `supabase-folkets`)

**Read-only prod snapshot (2026-10-26):** none of #185 objects exist yet. `vector` **0.8.0** is installed in **`public`**. `pg_trgm` and `unaccent` are **available but not installed**. `document_chunks` ≈ **380 299** rows / **814 MB**. `stortinget_issues` ≈ **480** rows, **no `tsv` column** today.

**Coolify Expert prod GUC / container check (read-only, same date):** `maintenance_work_mem` **64MB**; `max_parallel_maintenance_workers` **2**; `shared_buffers` **128MB**; `max_wal_size` **1GB**; **`/dev/shm` only 64MB** in the `supabase-db` container. Realtime replication slot **`cainophile_vlftkp89`** was **~2.1GB behind** (retains WAL). Re-check slot lag and disk before phase A/B.

Migrations are applied **manually** by the Coolify Expert, only after Mathias approves. Do not use `supabase db push` blindly on prod.

**fm-web** auto-deploys on push to `main` — merge PR **only after** this runbook completes and verification passes.

## Maintenance windows (two phases)

| Phase | Migrations | Pause n8n ingest? | Planned duration |
| --- | --- | --- | --- |
| **A — transactional** | `20261022100000`–`20261022108000` + `20261022109600` | **Yes** — no document ingest / embedding writes to `document_chunks` | **~15 minutes** (bench: `22100000` ~74 s ACCESS EXCLUSIVE on ~380k rows; expect **1.5–3 min** under load; +523 MB table, ~1.2 GB WAL) |
| **B — concurrent indexes** | `20261022109000`–`20261022109500` (six files, one `psql` session each) | **Yes (recommended)** — see [n8n during index phase](#n8n-during-the-index-phase) | **≥ 60 minutes** wall clock (sum of builds + invalid-index checks; IO-bound) |

Do **not** use a single 15-minute window for the full stack. Schedule phase B as its own block.

## Order of operations (do not reorder)

1. **Pause n8n** workflows that ingest documents or run embedding batches (`dokument-embeddings`, embedding_v2 queue, pipeline health catch-up that writes `document_chunks`).
2. **Phase A — transactional** (`22100000`–`22108000`, then **`22109600`**) with [transactional session settings](#phase-a--transactional-session-settings).
3. **Phase B — indexes** (`22109000`–`22109500`) with [concurrent-index session settings](#phase-b--concurrent-index-session-settings). After **each** file: [invalid-index check](#after-each-concurrent-index-file); if invalid → `DROP INDEX CONCURRENTLY` → re-run that file.
4. **Verify** (extensions, columns, all indexes valid, grants, smoke `search_issues_fts` as service role).
5. **Resume n8n**, then **merge** PR (app already calls search RPCs via service role after Stemme+ gate).

CI `scripts/run-prod-like-db-security.sh` applies all `202610221*.sql` in **filename sort** (`22109600` runs after concurrent indexes). On prod, apply **`22109600` immediately after `22108000`** and **before** phase B.

### n8n during the index phase

**Keep ingest and embedding pipelines paused through phase B** (do not resume n8n between `22109600` and a clean invalid-index check after `22109500`).

- **Why:** `CREATE INDEX CONCURRENTLY` on ~380k `document_chunks` rows is IO-heavy (GIN `tsv` alone is often **10–45 min** worst case). Competing chunk inserts/updates and embedding batch writes increase WAL and autovacuum work, stretch build times, and make the **≥ 60 min** index window unreliable.
- **Why not “resume early”:** Hybrid RAG is not production-ready until all six indexes are **valid** (`indisvalid = true`). Partial or invalid indexes (`IF NOT EXISTS` can exit 0 on a broken index) are worse than waiting.
- **After phase B:** Resume n8n; `embedding_v2` backfill and docling ingest can run with indexes in place (row-level updates; consider `REINDEX INDEX CONCURRENTLY` on HNSW after large backfill).

## Phase A — transactional session settings

Use before **every** `psql -f` for `20261022100000` through `20261022108000` and `20261022109600`:

```sql
SET lock_timeout = '30s';
SET statement_timeout = '10min';
```

```bash
export PGOPTIONS='-c lock_timeout=30s -c statement_timeout=10min'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<transactional-file>.sql
```

**Exception — `20261022100000`:** that file opens with `BEGIN` and runs `SET lock_timeout = '5s'` inside the transaction. For the heap rewrite on `document_chunks`, **5 s** is the effective lock timeout (not the session `30s` above). If `22100000` aborts waiting on `ACCESS EXCLUSIVE`, retry in a quieter window; do not raise session `lock_timeout` expecting it to override the in-migration `5s` without editing the migration (out of scope for apply).

**Rollback (per transactional file):** only practical if the migration failed before `COMMIT` — restore from snapshot / PITR. Do not drop `document_chunks.tsv` / `embedding_v2` after a successful `22100000` without a new window.

## Extensions (transactional migrations)

| Step | File | What |
| --- | --- | --- |
| 1 | `20261022105000_rag_hybrid_prefix_trgm.sql` | `CREATE SCHEMA IF NOT EXISTS extensions`; preflight `ALTER EXTENSION pg_trgm SET SCHEMA extensions` if still in `public`; `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions` |
| 2 | `20261022106000_rag_unaccent_short_title_tsv.sql` | Same preflight for `unaccent` (and `pg_trgm` if needed); `CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions`; `public.fm_unaccent(text)` |

`vector` stays in `public` (already installed). RAG RPCs use `search_path = public, extensions, pg_temp`.

## Transactional RAG migrations (phase A files)

Apply after main is at `20261021170000_issue_ai_summary_no_cost_in_how_affected.sql` (or later main head):

| # | File | Notes |
| --- | --- | --- |
| 1 | `20261022100000_hybrid_search_and_embedding_v2.sql` | `document_chunks.tsv` GENERATED, `embedding_v2`, `stortinget_issues.tsv`, RPCs — **heavy lock** (see below) |
| 2 | `20261022101000_document_chunk_metadata_content_hash.sql` | comment only (index deferred) |
| 3 | `20261022102000_stortinget_hearings.sql` | hearings + hearing hybrid RPC |
| 4 | `20261022103000_docling_ingest_and_embedding_v2_rpcs.sql` | docling + embedding_v2 queue RPCs |
| 5 | `20261022104000_rag_issue_search_sak_aggregate.sql` | |
| 6 | `20261022105000_rag_hybrid_prefix_trgm.sql` | **pg_trgm** + hybrid RPC |
| 7 | `20261022106000_rag_unaccent_short_title_tsv.sql` | **unaccent** + issue `tsv` rebuild + `search_issues_fts` |
| 8 | `20261022107000_rag_issue_search_ilike_boost.sql` | |
| 9 | `20261022108000_rag_issue_search_sak_prefix.sql` | `chunk_sak` uses `websearch_to_tsquery('norwegian', raw)` on chunk `tsv` (not `fm_unaccent`) |
| 10 | `20261022109600_rag_search_rpc_service_role_only.sql` | REVOKE search RPCs + `fm_unaccent` / `fm_escape_ilike` from anon/authenticated |

### Locking — `document_chunks.tsv` (`20261022100000`)

Measured on a **copy** (`rag-eval-pg`) on the same host (**klever**), PostgreSQL **15.19**, idle (~380k rows). **Prod under load may be slower.**

- **`ACCESS EXCLUSIVE`** for ~**74 s** on that idle copy; on prod under load expect **~1.5–3 min** (blocks RAG/search reads on `document_chunks`).
- Heap growth about **+523 MB** on table; WAL about **~1.2 GB** for the rewrite.

`stortinget_issues.tsv` (~480 rows) is cheap in the same file.

### Backfills (not in migrations)

| Work | How | Locking |
| --- | --- | --- |
| **`embedding_v2` (bge-m3 / 1024)** | Coolify one-off `scripts/backfill-embedding-v2.ts` → `n8n_claim_chunks_missing_v2` + `save_embeddings_v2` (with worker lease); health `n8n_embedding_backlog_health` | Row-level updates; after **#185** phase B + **[`EMBEDDING_V2_QUEUE_APPLY.md`](./EMBEDDING_V2_QUEUE_APPLY.md)** (`26110100`–`26110300`, then `26110000` index) |
| **`tsv` on chunks** | **GENERATED** after `22100000` — no separate SQL backfill | One-time heap rewrite on column add |
| **Legacy `embedding` (768)** | Unchanged | — |

Optional batched manual chunk `tsv` refresh (only if GENERATED is ever dropped): `supabase/hotfix/20261022_document_chunks_tsv_batch_template.sql`.

## Phase B — concurrent index session settings

Each file is **one** `CREATE INDEX CONCURRENTLY IF NOT EXISTS`. Do **not** wrap in `BEGIN`/`COMMIT`. Do **not** reuse phase A `statement_timeout = '10min'` — long GIN builds will be killed.

Apply the **same session GUCs for every index file** (`22109000`–`22109500`), including HNSW **`22109200`**:

- **`maintenance_work_mem = '1GB'`** — prod default is **64MB**; raising it per session speeds GIN builds without a server restart.
- **`max_parallel_maintenance_workers = 0`** — prod default is **2**, but parallel maintenance workers use **`/dev/shm`**. The `supabase-db` container only has **64MB** `/dev/shm`; Coolify hit **`could not resize shared memory segment` / `No space left on device`** on the bench when parallel workers were left enabled.

Before **each** index file (session `SET` **or** equivalent `PGOPTIONS`):

```sql
SET lock_timeout = '30s';
SET statement_timeout = 0;   -- preferred: no server-side cap on index build
-- Alternative if policy forbids 0: SET statement_timeout = '60min';
SET maintenance_work_mem = '1GB';
SET max_parallel_maintenance_workers = 0;
```

```bash
export PGOPTIONS='-c lock_timeout=30s -c statement_timeout=0 -c maintenance_work_mem=1GB -c max_parallel_maintenance_workers=0'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<index-file>.sql
```

### Watch during phase A and B — WAL, replication, disk

Phase A heap rewrite and phase B index builds generate WAL. The **realtime** slot **`cainophile_vlftkp89`** was **~2.1GB lagging** on the read-only check and **holds WAL** until it catches up.

During and after apply, monitor:

```sql
SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal
FROM pg_replication_slots
WHERE slot_name = 'cainophile_vlftkp89';
```

Also watch **disk free** on the Postgres volume (`max_wal_size` is **1GB** on prod; lagging slots can push retained WAL well beyond that). Coordinate with whoever owns realtime if lag grows during the window.

### Out of scope for this apply (not blockers; Mathias decides separately)

- **Raise `shm_size`** on the `supabase-db` container (would allow parallel maintenance workers; needs container config change).
- **Raise `shared_buffers`** (prod **128MB** today) — requires **Postgres restart**.

| Order | File | Index name | Measured / expected duration |
| --- | --- | --- | --- |
| A | `20261022109000_rag_index_document_chunks_tsv_gin_concurrent.sql` | `document_chunks_tsv_gin_idx` | **10–45 min** worst case on ~380k rows; **5–20 min** typical (IO-bound) |
| B | `20261022109100_rag_index_stortinget_issues_tsv_gin_concurrent.sql` | `stortinget_issues_tsv_gin_idx` | **&lt;1 min** |
| C | `20261022109200_rag_index_document_chunks_embedding_v2_hnsw_concurrent.sql` | `document_chunks_embedding_v2_hnsw_idx` | **minutes** (empty at first; reindex after large backfill) |
| D | `20261022109300_rag_index_document_chunks_content_trgm_concurrent.sql` | `document_chunks_content_trgm_idx` | **~98 s** on `rag-eval-pg` copy (klever, PG 15.19, idle); prod under load may be slower |
| E | `20261022109400_rag_index_stortinget_issues_title_trgm_concurrent.sql` | `stortinget_issues_title_trgm_idx` | **&lt;1 min** |
| F | `20261022109500_rag_index_document_chunks_metadata_hash_concurrent.sql` | `document_chunks_metadata_content_hash_idx` | **5–20 min** typical |

**Phase B wall clock:** plan **≥ 60 minutes** for all six steps plus invalid-index checks (dominated by `22109000` GIN on `document_chunks.tsv`).

### After each concurrent index file

```sql
SET lock_timeout = '30s';
SET statement_timeout = '10min';

SELECT c.relname AS index_name, i.indisvalid
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_class t ON t.oid = i.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND NOT i.indisvalid
  AND c.relname = '<index_name_from_table_above>';
```

- **Expected:** zero rows for the index you just built.
- **If `indisvalid = false`:** `CREATE INDEX CONCURRENTLY IF NOT EXISTS` may have exited **0** anyway. Fix:

```sql
SET lock_timeout = '30s';
SET statement_timeout = 0;
DROP INDEX CONCURRENTLY IF EXISTS public.<index_name>;
```

Then re-run **only** that migration file with phase B `PGOPTIONS`, and repeat the invalid-index check.

**Rollback per index step:** `DROP INDEX CONCURRENTLY IF EXISTS public.<index_name>;` then re-run the matching `20261022109*.sql` file.

`CONCURRENTLY` avoids long **ACCESS EXCLUSIVE** locks on `document_chunks`; builds still use CPU/IO. Monitor `pg_stat_progress_create_index`.

Apply **A** before heavy hybrid FTS load; **C** can precede or follow embedding_v2 backfill. If HNSW was built empty and millions of rows are backfilled later, consider `REINDEX INDEX CONCURRENTLY` on `document_chunks_embedding_v2_hnsw_idx` during a window.

## Final verification (after phase B)

```sql
SET lock_timeout = '30s';
SET statement_timeout = '10min';

-- Extensions (pg_trgm / unaccent in extensions, vector in public)
SELECT e.extname, n.nspname
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname IN ('vector', 'pg_trgm', 'unaccent');

-- Columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('document_chunks', 'stortinget_issues')
  AND column_name IN ('tsv', 'embedding_v2', 'embedding_model');

-- Invalid indexes (must be empty before merge)
SELECT c.relname AS index_name, i.indisvalid
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_class t ON t.oid = i.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND NOT i.indisvalid
  AND t.relname IN ('document_chunks', 'stortinget_issues');

-- Indexes (expect 6 RAG names + existing PK/FK)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('document_chunks', 'stortinget_issues')
  AND (
    indexname LIKE '%tsv%'
    OR indexname LIKE '%trgm%'
    OR indexname LIKE '%embedding_v2%'
    OR indexname LIKE '%content_hash%'
  )
ORDER BY 1;

-- RPC grants: service_role only (authenticated/anon must be false)
SELECT p.proname,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_ok,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_ok,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_ok
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'search_issues_fts',
    'search_chunks_hybrid',
    'search_hearing_document_chunks_text',
    'search_stortinget_issues_for_chat',
    'search_issue_document_chunks_text',
    'fm_unaccent',
    'fm_escape_ilike'
  );

-- Sample FTS (service_role session / direct SQL as postgres)
SELECT id, title FROM search_issues_fts('statsbudsjett', NULL, 3);
```

## Phase D — v2 backfill queue (`26110000`–`26110100`)

Apply **after** phase B indexes are valid. Order:

1. `20261026110000_document_chunks_v2_pending_issue_idx_concurrent.sql` — **outside** `BEGIN` (same session GUCs as phase B).
2. After each CONCURRENTLY file: invalid-index check (see phase B). Rollback: `DROP INDEX CONCURRENTLY IF EXISTS public.document_chunks_v2_pending_issue_idx;`
3. `20261026110100_embedding_v2_queue_and_gates.sql` — transactional RPCs + gates.
4. `20261026110200_embedding_backlog_health_perf.sql` — fast health RPC (estimated totals + exact tier-0).

Then start `scripts/backfill-embedding-v2.ts` (see README).

## CI / prod-like test

`scripts/run-prod-like-db-security.sh` applies `202610221*.sql` in phase 4 on an empty test DB (small data); concurrent index files are included in sort order and run without an explicit transaction wrapper.
