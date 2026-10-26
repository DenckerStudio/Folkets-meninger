# EXPLAIN: `n8n_embedding_backlog_health` (26110200)

Prod-scale shape (~380k `document_chunks`, most v2-pending): totals use `fm_estimate_pending_chunk_count`
(capped exact count up to 10 001 rows, else `pg_class.reltuples` estimate). Tier-0 active metrics use a **small
candidate set** from `stortinget_issues` / polls / hearings, then `JOIN document_chunks` on `issue_id` with
predicate `embedding_v2 IS NULL AND embedding_v2_status = 'pending'` — eligible for
`document_chunks_v2_pending_issue_idx`.

`fm_embedding_v2_issue_tier()` is **not** invoked inside the health RPC (avoids O(pending issues) UDF cost).

## Representative plan (CI fixture, 6 tier-0 chunks)

Run locally after migrations:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/embedding_backlog_health_explain.sql
```

Expected properties:

- No `fm_embedding_v2_issue_tier` in `EXPLAIN` output
- Tier-0 chunk fetch uses `Index Scan` or `Bitmap Index Scan` on `document_chunks_v2_pending_issue_idx` when present
- Function runtime target &lt;1s on fixture; statement timeout 60s on prod health cron

## Rollback

Apply `20261026110100` definition of `n8n_embedding_backlog_health()` from git history, or `DROP FUNCTION` +
restore previous body.
