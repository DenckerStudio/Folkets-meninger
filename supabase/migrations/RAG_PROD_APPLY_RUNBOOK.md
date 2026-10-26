# PR #185 RAG stack — production apply runbook (Coolify `supabase-folkets`)

**Read-only prod snapshot (2026-10-26):** none of #185 objects exist yet. `vector` **0.8.0** is installed in **`public`**. `pg_trgm` and `unaccent` are **available but not installed**. `document_chunks` ≈ **380 299** rows / **814 MB**. `stortinget_issues` ≈ **480** rows, **no `tsv` column** today.

Migrations are applied **manually** by the Coolify Expert, only after Mathias approves. Do not use `supabase db push` blindly on prod.

## Extensions (transactional migrations)

| Step | File | What |
| --- | --- | --- |
| 1 | `20261022105000_rag_hybrid_prefix_trgm.sql` | `CREATE SCHEMA IF NOT EXISTS extensions`; `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions` |
| 2 | `20261022106000_rag_unaccent_short_title_tsv.sql` | `CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions`; `public.fm_unaccent(text)` |

`vector` stays in `public` (already installed). RAG RPCs use `search_path = public, extensions, pg_temp`.

## Transactional RAG migrations (run in order, normal `psql -f`)

Apply after main is at `20261021170000_issue_ai_summary_no_cost_in_how_affected.sql` (or later main head):

1. `20261022100000_hybrid_search_and_embedding_v2.sql` — columns (`document_chunks.tsv` GENERATED, `embedding_v2`, `stortinget_issues.tsv`), RPCs  
2. `20261022101000_document_chunk_metadata_content_hash.sql` — comment only (index deferred)  
3. `20261022102000_stortinget_hearings.sql` — hearings tables + hearing hybrid RPC  
4. `20261022103000_docling_ingest_and_embedding_v2_rpcs.sql` — docling + embedding_v2 queue RPCs  
5. `20261022104000_rag_issue_search_sak_aggregate.sql`  
6. `20261022105000_rag_hybrid_prefix_trgm.sql` — **pg_trgm** + hybrid RPC  
7. `20261022106000_rag_unaccent_short_title_tsv.sql` — **unaccent** + issue `tsv` rebuild + `search_issues_fts`  
8. `20261022107000_rag_issue_search_ilike_boost.sql`  
9. `20261022108000_rag_issue_search_sak_prefix.sql`  

### Locking note — `document_chunks.tsv` (22100000)

`ADD COLUMN … GENERATED ALWAYS AS (…) STORED` on **~380k** rows takes an **ACCESS EXCLUSIVE** lock and rewrites the heap (minutes, not hours). Schedule a **maintenance window**. This is separate from index builds below.

`stortinget_issues.tsv` (~480 rows) is cheap in the same file.

### Backfills (not in migrations)

| Work | How | Locking |
| --- | --- | --- |
| **`embedding_v2` (bge-m3 / 1024)** | n8n → `n8n_list_pending_embedding_v2` / `n8n_save_document_embedding_v2` (see `20261022103000`) | Row-level updates; run in batches via pipeline |
| **`tsv` on chunks** | Maintained by **GENERATED** column after 22100000 — no separate SQL backfill | One-time heap rewrite on column add |
| **Legacy `embedding` (768)** | Unchanged | — |

Optional batched **manual** chunk `tsv` refresh (only if Expert ever drops GENERATED): see `supabase/hotfix/20261022_document_chunks_tsv_batch_template.sql`.

## Index migrations — **RUN OUTSIDE A TRANSACTION** (one file ≈ one `psql` session)

Each file contains a **single** `CREATE INDEX CONCURRENTLY IF NOT EXISTS`. Do **not** wrap in `BEGIN`/`COMMIT`. Supabase CLI transactional migrate runners must **skip** these or run them with `transaction=false` tooling; Coolify applies with:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<file>.sql
```

| Order | File | Index | Prod duration (order of magnitude) |
| --- | --- | --- | --- |
| A | `20261022109000_rag_index_document_chunks_tsv_gin_concurrent.sql` | GIN on `document_chunks.tsv` | **10–45 min** (380k rows) |
| B | `20261022109100_rag_index_stortinget_issues_tsv_gin_concurrent.sql` | GIN on `stortinget_issues.tsv` | **&lt;1 min** |
| C | `20261022109200_rag_index_document_chunks_embedding_v2_hnsw_concurrent.sql` | partial HNSW on `embedding_v2` | **minutes** (empty at first; rebuild if needed after large backfill) |
| D | `20261022109300_rag_index_document_chunks_content_trgm_concurrent.sql` | GIN trgm on `content` | **15–60 min** |
| E | `20261022109400_rag_index_stortinget_issues_title_trgm_concurrent.sql` | GIN trgm on `title` | **&lt;1 min** |
| F | `20261022109500_rag_index_document_chunks_metadata_hash_concurrent.sql` | btree on `(issue_id, document_id, content_hash)` | **5–20 min** |

`CONCURRENTLY` avoids long **ACCESS EXCLUSIVE** locks on `document_chunks`; builds still use CPU/IO. Monitor `pg_stat_progress_create_index`.

Apply **A** before heavy hybrid FTS load; **C** can precede or follow embedding_v2 backfill (partial index). If HNSW is built on an empty set and millions of rows are backfilled later, consider `REINDEX INDEX CONCURRENTLY` on `document_chunks_embedding_v2_hnsw_idx` during a window.

## Verification queries

```sql
-- Extensions
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

-- RPC grants (authenticated)
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'search_issues_fts', 'search_chunks_hybrid',
    'search_hearing_document_chunks_text', 'fm_unaccent'
  );

-- Sample FTS (after indexes)
SELECT id, title FROM search_issues_fts('statsbudsjett', NULL, 3);
```

## CI / prod-like test

`scripts/run-prod-like-db-security.sh` applies `202610221*.sql` in phase 3 on an empty test DB (small data); concurrent index files are included in sort order and run without an explicit transaction wrapper.
