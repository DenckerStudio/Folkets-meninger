# PR #185 RAG stack — production apply runbook (Coolify `supabase-folkets`)

**Read-only prod snapshot (2026-10-26):** none of #185 objects exist yet. `vector` **0.8.0** is installed in **`public`**. `pg_trgm` and `unaccent` are **available but not installed**. `document_chunks` ≈ **380 299** rows / **814 MB**. `stortinget_issues` ≈ **480** rows, **no `tsv` column** today.

Migrations are applied **manually** by the Coolify Expert, only after Mathias approves. Do not use `supabase db push` blindly on prod.

**Maintenance window:** plan **15 minutes** end-to-end (measured on prod host, ~380k `document_chunks`). **fm-web** auto-deploys on push to `main` — merge PR **only after** this runbook completes and verification passes.

## Session settings (every `psql` session)

```sql
SET lock_timeout = '30s';
SET statement_timeout = '10min';
```

Use the same settings before each transactional file and each `CREATE INDEX CONCURRENTLY` file.

## Order of operations (do not reorder)

1. **Pause n8n** workflows that ingest documents or run embedding batches (`dokument-embeddings`, embedding_v2 queue, pipeline health catch-up that writes chunks). Empty queue is fine; avoid new chunk writes during `22100000` heap rewrite.
2. **Transactional migrations** `20261022100000` through `20261022108000`, then **`20261022109600_rag_search_rpc_service_role_only.sql`** (search RPCs + `fm_unaccent` / `fm_escape_ilike` → **service_role only**).
3. **Index migrations** `20261022109000` through `20261022109500` (one file per session, **no transaction**).
4. **Verify** (extensions, columns, indexes valid, grants, smoke `search_issues_fts` as service role).
5. **Resume n8n**, then **merge** PR / deploy app (chat already calls RPCs with service role after Stemme+ gate).

CI `scripts/run-prod-like-db-security.sh` applies all `202610221*.sql` in **filename sort** (`22109600` runs after concurrent indexes). That is acceptable for grants; on prod, apply **`22109600` immediately after `22108000`** and before step 3.

## Extensions (transactional migrations)

| Step | File | What |
| --- | --- | --- |
| 1 | `20261022105000_rag_hybrid_prefix_trgm.sql` | `CREATE SCHEMA IF NOT EXISTS extensions`; preflight `ALTER EXTENSION pg_trgm SET SCHEMA extensions` if still in `public`; `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions` |
| 2 | `20261022106000_rag_unaccent_short_title_tsv.sql` | Same preflight for `unaccent` (and `pg_trgm` if needed); `CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions`; `public.fm_unaccent(text)` |

`vector` stays in `public` (already installed). RAG RPCs use `search_path = public, extensions, pg_temp`.

## Transactional RAG migrations (run in order, normal `psql -f`)

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

Coolify Expert bench on prod host (~380k rows):

- **`ACCESS EXCLUSIVE`** for ~**74 s** on idle host; under load expect **~1.5–3 min** (blocks RAG/search reads on `document_chunks`).
- Heap growth about **+523 MB** on table; WAL about **~1.2 GB** for the rewrite.

`stortinget_issues.tsv` (~480 rows) is cheap in the same file.

**Rollback (22100000):** only if migration failed before `COMMIT` — restore from snapshot / PITR. After commit, dropping `tsv` / `embedding_v2` is a new maintenance window (not recommended).

### Backfills (not in migrations)

| Work | How | Locking |
| --- | --- | --- |
| **`embedding_v2` (bge-m3 / 1024)** | n8n → `n8n_list_pending_embedding_v2` / `n8n_save_document_embedding_v2` | Row-level updates; batches via pipeline |
| **`tsv` on chunks** | **GENERATED** after `22100000` — no separate SQL backfill | One-time heap rewrite on column add |
| **Legacy `embedding` (768)** | Unchanged | — |

Optional batched manual chunk `tsv` refresh (only if GENERATED is ever dropped): `supabase/hotfix/20261022_document_chunks_tsv_batch_template.sql`.

## Index migrations — **RUN OUTSIDE A TRANSACTION**

Each file is a **single** `CREATE INDEX CONCURRENTLY IF NOT EXISTS`. Do **not** wrap in `BEGIN`/`COMMIT`.

```bash
export PGOPTIONS='-c lock_timeout=30s -c statement_timeout=10min'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<file>.sql
```

After **each** index file, run **invalid-index check** (see Verification). If an index is invalid, `CREATE INDEX CONCURRENTLY IF NOT EXISTS` may **exit 0** and leave a broken index — drop and rebuild.

| Order | File | Index | Measured / expected duration |
| --- | --- | --- | --- |
| A | `20261022109000_rag_index_document_chunks_tsv_gin_concurrent.sql` | GIN on `document_chunks.tsv` | **~10–45 min** (380k rows; IO-bound) |
| B | `20261022109100_rag_index_stortinget_issues_tsv_gin_concurrent.sql` | GIN on `stortinget_issues.tsv` | **&lt;1 min** |
| C | `20261022109200_rag_index_document_chunks_embedding_v2_hnsw_concurrent.sql` | partial HNSW on `embedding_v2` | **minutes** (empty at first; reindex after large backfill) |
| D | `20261022109300_rag_index_document_chunks_content_trgm_concurrent.sql` | GIN trgm on `content` | **~98 s** trgm GIN on prod bench; allow headroom under load |
| E | `20261022109400_rag_index_stortinget_issues_title_trgm_concurrent.sql` | GIN trgm on `title` | **&lt;1 min** |
| F | `20261022109500_rag_index_document_chunks_metadata_hash_concurrent.sql` | btree on `(issue_id, document_id, content_hash)` | **~5–20 min** |

**Rollback per concurrent index step:** `DROP INDEX CONCURRENTLY IF EXISTS <indexname>;` then re-run the matching migration file after fixing the failure (disk, `statement_timeout`, duplicate invalid index).

`CONCURRENTLY` avoids long **ACCESS EXCLUSIVE** locks on `document_chunks`; builds still use CPU/IO. Monitor `pg_stat_progress_create_index`.

Apply **A** before heavy hybrid FTS load; **C** can precede or follow embedding_v2 backfill. If HNSW was built empty and millions of rows are backfilled later, consider `REINDEX INDEX CONCURRENTLY` on `document_chunks_embedding_v2_hnsw_idx` during a window.

## Verification queries

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

## CI / prod-like test

`scripts/run-prod-like-db-security.sh` applies `202610221*.sql` in phase 3 on an empty test DB (small data); concurrent index files are included in sort order and run without an explicit transaction wrapper.
