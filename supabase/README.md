# Supabase migrations and schema runbook

Supabase backs auth-adjacent user state, anonymous voting receipts, forum
content, notifications, Stortinget issue caches, AI summary data, and document
RAG tables.

## Local / test environments

| Environment | URL | How to use |
|-------------|-----|------------|
| Test (self-hosted) | `https://supabase.heyklever.app` | `npm run env:test` → writes `.env.local` from `.env.test` |
| Local Docker | `http://127.0.0.1:54321` | `npm run supabase:start`, then copy keys from `npm run supabase:status` into `.env.local` |

`supabase/config.toml` enables the Supabase CLI against this repo's migrations.
Docker is required for `supabase start`. CI and Playwright use the heyklever
test instance via `.env.test` / workflow env (anon key only).

```bash
# Point the app at the heyklever test Supabase
npm run env:test
npm run dev

# Or run a full local stack (Docker required)
npm run supabase:start
npm run supabase:status
```

Set `SUPABASE_SERVICE_ROLE_KEY` separately for server RPCs (voting, admin). It
is never committed.

### Vercel (production / preview)

Vercel cannot reach `127.0.0.1` — use the self-hosted heyklever instance
(`https://supabase.heyklever.app`), same as `.env.test`.

```bash
# One-time: create https://vercel.com/account/tokens
export VERCEL_TOKEN=...
export HEYKLEVER_SUPABASE_SERVICE_ROLE_KEY=...   # heyklever service role (server-only)
npm run vercel:env:supabase
```

This upserts `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
optionally `SUPABASE_SERVICE_ROLE_KEY` on project `folkets-inspill` for
production, preview, and development. Redeploy after syncing.

Dry run: `npm run vercel:env:supabase -- --dry-run`

## Applying migrations

Run migrations against your Supabase project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Against local Docker:

```bash
npx supabase db reset
```

Or paste `supabase/migrations/*.sql` into the Supabase SQL editor.

## Migration index

| Domain | Migrations | Main objects |
|--------|------------|--------------|
| Anonymous voting | `20260528000001_anonymous_voting.sql`, `20260528000002_vote_schema_repair.sql`, `20260618120000_sak_voting_status.sql` | `citizen_votes`, `user_vote_receipts`, `cast_vote`, vote aggregate RPCs |
| Notifications | `20260528000003_notifications.sql` | `notification_preferences`, `notification_category_subscriptions`, `notifications` |
| AI summaries | `20260528120000_issue_ai_summaries.sql`, `20260529120000_simplify_issue_ai_summaries.sql` | `issue_ai_summaries` |
| Auth/user sync + hearings comments | `20260529150000_users_auth_sync.sql`, `20260601120000_forum_public_identity.sql` | `users`, `ensure_public_user`, `user_has_forum_identity`, `hearing_comments`, `create_hearing_comment` |
| Forum base/features | `20260530120000_forum_enhancements.sql`, `20260531120000_production_readiness.sql`, `20260531140000_forum_prompts_dedupe.sql` | forum threads/replies/likes/prompts and production indexes |
| Forum reports/sources | `20260602120000_forum_reports_enhance.sql`, `20260602130000_forum_trusted_sources.sql` | `forum_reports`, `forum_trusted_sources` |
| Forum profiles/points/moderation | `20260614130000_forum_profiles_points_ai_sources.sql`, `20260614160000_harden_forum_points_moderation.sql`, `20260614170000_public_user_display_grants.sql` | public profile fields, point ledgers, moderation RPCs/grants |
| Forum sak-RAG prompts | `20260621120000_forum_sak_rag_prompts.sql` | `forum_prompts.generation_metadata`, `forum_research_clusters.source_type`, `get_sak_prompt_coverage` |
| Stortinget sak metadata | `20260616120000_stortinget_issue_sak_kind.sql`, `20260618140000_stortinget_issues_category.sql`, `20260702160000_backfill_ferdigbehandlet_from_detail.sql` | `sak_kind`, `henvisning`, `dokumentgruppe`, `category`, `ferdigbehandlet` repair |
| Sak documents/RAG | `20260617120000_sak_documents_rag.sql`, `20260807112603_document_chunks_storage_efficiency.sql` | `stortinget_issue_documents`, `document_chunks`, `chunks_status`, `match_issue_document_chunks`, reclaim helpers |

## Voting setup

1. Apply `20260528000001_anonymous_voting.sql` (requires `pgcrypto` in the `extensions` schema — standard on Supabase).
2. If voting fails with 500, ambiguous `cast_vote`, or legacy schema errors, run **`20260528000002_vote_schema_repair.sql`**.
3. Set a strong pepper **without** requiring `ALTER DATABASE` permissions:

```sql
INSERT INTO private.app_settings (key, value)
VALUES ('vote_encryption_secret', 'your-long-random-secret')
ON CONFLICT (key) DO UPDATE SET value = excluded.value;
```

4. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in the Next.js app (server-only).

### Architecture

| Table | Purpose |
|-------|---------|
| `citizen_votes` | Anonymous ballots (`issue_id` + `choice` only) |
| `user_vote_receipts` | One row per user per issue; `choice` stored as `pgp_sym_encrypt` |
| `stortinget_issues` | Issue title/summary cache |

Aggregates are exposed via `get_issue_vote_totals` / `get_vote_totals_batch`. Direct reads on `citizen_votes` are denied by RLS.

### Voting closure rules

`20260618120000_sak_voting_status.sql` adds `ferdigbehandlet` and
`voting_closes_at` to `stortinget_issues` and updates `cast_vote` so closed saker
cannot receive new ballots. A vote is rejected when any of these are true:

- `stortinget_issues.status = 'closed'`
- `stortinget_issues.ferdigbehandlet IS TRUE`
- `stortinget_issues.voting_closes_at <= now()`

The Next.js API mirrors this in `app/api/vote/route.ts` so users receive a 403
before the RPC, but the RPC is the final enforcement point.

`voting_closes_at` is derived by `lib/sak-voting-window.ts` from Stortinget
saksgang events (`VOT`, `VEDTAK`, `BEHS`, and related treatment event IDs).
Repair stale status/deadline data with:

```bash
npx tsx scripts/backfill-sak-status.ts --pending-only --concurrency 8
```

## Stortinget issue cache

`stortinget_issues` is both the list cache and the anchor table for votes,
summaries, forum prompts, documents, and government stats.

| Column | Source / purpose |
|--------|------------------|
| `status`, `ferdigbehandlet`, `voting_closes_at` | Voting lifecycle and UI labels |
| `sak_kind` | App-friendly type, currently `lovforslag` or `representantforslag` |
| `henvisning`, `dokumentgruppe` | Stortinget metadata used in labels and filtering |
| `category` | Denormalized emne/category for list queries |
| `detail_json` | Cached Stortinget detail payload |
| `ai_summary_source_*` | Source context/hash used by n8n AI summary generation |

`lib/sak-status.ts` is the central resolver for "Under behandling" vs
"Ferdigbehandlet". Do not trust one Stortinget field alone: list exports can keep
`status = 1` after treatment is finished, while cached details or
`innstilling_id`/`innstilling_kode` may already show completion. Current list and
sync paths merge:

1. `detail_json.ferdigbehandlet` when available.
2. The denormalized `stortinget_issues.ferdigbehandlet` column.
3. Fresh list `status`, plus list `innstilling_*` completion hints.
4. Existing cached `status` as a fallback.

`lib/stortinget-saker-cache.ts` owns list reads. It uses a 30-minute in-memory
cache, a 30-minute `unstable_cache` wrapper around the DB list, and a 6-hour DB
freshness threshold before falling back to live Stortinget data. During
`next build` (`NEXT_PHASE=phase-production-build`) `getSakerWithCache()` returns
an empty list instead of calling Supabase or Stortinget, so pages must tolerate an
empty sak list at build time.

`lib/stortinget-detail-cache.ts` owns per-sak detail refreshes. Detail JSON is
fresh for 24 hours. Full refreshes update `detail_json`, treatment state,
`voting_closes_at`, AI summary source context, and document ingest triggers.
`refreshSakStatusOnly()` updates status metadata only and is what
`scripts/backfill-sak-status.ts` uses for bulk repair.

Cron sync (`GET /api/cron/sync-issues`) calls `syncStortingetIssuesToDb()`, reads
the live list with `fetchRawSakerFromStortinget()`, filters to `isDebattSak()`,
enriches DB overlays/vote totals, and then upserts changed rows. It also refreshes
details for new or missing-summary issues and sweeps up to 10 stale pending
details. The response contains `upserted`, `total`, `newIssueIds`,
`aiSummaryTriggered`, and `detailsRefreshed`.

Use the SQL migration `20260702160000_backfill_ferdigbehandlet_from_detail.sql`
only for historical drift where `detail_json.ferdigbehandlet` and the
denormalized column disagree. Use the status backfill script when live Stortinget
detail data should refresh status/deadline metadata:

```bash
npx tsx scripts/backfill-sak-status.ts --pending-only --concurrency 8
```

## Hearings (høring comments)

Høring metadata is not stored in Postgres. The app reads live Stortinget data via
`lib/stortinget-horinger.ts` and the `/api/horinger` read proxy. Local user
comments are stored separately in `hearing_comments` and are keyed by
`stortinget_hearing_id` text, not by a local `hearings` table.

| Object | Purpose |
|--------|---------|
| `hearing_comments` | Public app comments for a Stortinget hearing id |
| `hearing_comments_select` | RLS policy allowing public reads |
| `create_hearing_comment(uuid, text, text)` | Service-role write RPC used by `POST /api/hearings` |

`create_hearing_comment` calls `ensure_public_user`, requires
`user_has_forum_identity`, trims bodies, and accepts 1-10000 characters. These
comments are not official submissions to Stortinget; the detail page labels them
as public app comments. They also do not use forum thread/reply moderation or
forum point triggers.

### Sak treatment status precedence

Status labels and voting availability are intentionally resolved from multiple
Stortinget sources because the list export can keep `status = 1` after a sak is
finished. `lib/sak-status.ts` applies this order:

1. Use `detail_json.ferdigbehandlet` when it is boolean; otherwise use the
   denormalized `stortinget_issues.ferdigbehandlet` column.
2. Combine that boolean with the freshest numeric Stortinget status available.
   List-export status wins over stale `detail_json.status` on list pages.
3. If no boolean is available, infer a finished sak from list `innstilling`
   fields (`innstilling_id > 0` and `innstilling_kode` 1 or 2).
4. Fall back to cached `status`; unknown status is treated as closed.

`lib/stortinget-saker-cache.ts` overlays live list-export status through
`applyLiveListExportStatuses()` when API refreshes are allowed, then persists
rows with `persistSakerListToDb()`. If the DB column drifts from cached detail
JSON, apply `20260702160000_backfill_ferdigbehandlet_from_detail.sql` or rerun:

```bash
npx tsx scripts/backfill-sak-status.ts --pending-only --concurrency 8
```

Treatment status is intentionally resolved from more than one source. The
application uses `lib/sak-status.ts` so `detail_json.ferdigbehandlet` wins over a
stale denormalized `ferdigbehandlet` column, fresh list-export numeric status can
override stale `detail_json.status`, and list `innstilling_id`/`innstilling_kode`
can imply a finished sak when Stortinget leaves list `status=1`.

If `stortinget_issues.ferdigbehandlet` drifts from cached detail data, apply
`20260702160000_backfill_ferdigbehandlet_from_detail.sql` or run:

```bash
npx tsx scripts/backfill-sak-status.ts --pending-only --concurrency 8
```

## Forum schema

Forum writes go through RPCs rather than direct client inserts.

| Object | Purpose |
|--------|---------|
| `create_forum_thread` / `create_forum_reply` | Validate identity, length, moderation, and official replies before insert |
| `forum_moderation_check` | DB-side regex moderation for hate, discrimination, sexual content, violence, and spam |
| `forum_reports` | One report per user/target; categories: `spam`, `harassment`, `misinformation`, `other` |
| `forum_trusted_sources` | Approved/pending/rejected domains for n8n forum reel source routing |
| `user_points_balances` / `user_points_ledger` | Public point balance and private per-user ledger |

Human forum authors must have `first_name` and `last_name` of at least two
characters. `ensure_public_user` syncs missing profile rows from Supabase Auth,
and `user_has_forum_identity` gates human thread/reply RPCs. System threads can
set `is_system_thread = true` and bypass the human identity requirement.

## Hearing comments

`20260601120000_forum_public_identity.sql` also defines local comments for
Stortinget hearings. There is no local hearings table; comments are keyed by the
Stortinget export id.

| Object | Purpose |
|--------|---------|
| `hearing_comments` | Public local comments for `/dashboard/horinger/<id>` |
| `hearing_comments_select` | RLS policy that allows public reads |
| `create_hearing_comment` | Service-role RPC used by `POST /api/hearings` |

`create_hearing_comment(p_user_id, p_stortinget_hearing_id, p_body)` calls
`ensure_public_user`, requires `user_has_forum_identity`, trims body text, allows
1-10000 characters, and rejects empty hearing ids. The Next.js route creates
mention notifications for `@name` matches after the RPC succeeds.

These comments are Folkets Stemme discussion entries only. They are not
submitted to Stortinget; the høring detail page links users to Stortinget for
official submissions.

Point triggers award:

| Event | Points |
|-------|--------|
| Approved human thread created | +10 |
| Approved reply created | +5 |
| Like given | +1 |
| Like received by another author | +2 |
| Vote receipt inserted | +3 |

Admin pages use `lib/forum/admin.ts`: `FORUM_ADMIN_EMAILS` allowlist first, then
Supabase `app_metadata.role = "admin"`.

### Hearing comments

Høringer themselves are not stored locally; pages fetch
`data.stortinget.no/eksport/horinger?format=json` through
`lib/stortinget-horinger.ts`. Local user input is stored in
`hearing_comments`, keyed by the Stortinget hearing id string.

`POST /api/hearings` uses `create_hearing_comment(p_user_id,
p_stortinget_hearing_id, p_body)` with the service role. The RPC calls
`ensure_public_user`, requires `user_has_forum_identity`, and enforces body
length 1-10000 characters. Reads are public through the
`hearing_comments_select` policy.

## Notifications

`20260528000003_notifications.sql` creates:

- `notification_preferences`: per-user email enablement and frequency by channel
  (`forum`, `mentions`, `categories` by default).
- `notification_category_subscriptions`: "hjertesaker" category subscriptions.
- `notifications`: in-app inbox rows with optional email delivery metadata.

Users can read/update their own preferences and inbox rows through RLS. Inserts
are server-side (`service_role`) via `lib/notifications.ts`. Digest delivery is
handled by `GET /api/cron/digest?frequency=daily|weekly` and needs SMTP env vars
from `.env.example`.

## Document ingest and RAG

`20260614130000_forum_profiles_points_ai_sources.sql` introduces
`stortinget_issue_documents`; `20260617120000_sak_documents_rag.sql` adds cached
HTML/text fields, `document_chunks`, pgvector, and `match_issue_document_chunks`.
`20260807112603_document_chunks_storage_efficiency.sql` adds `chunks_status`,
reclaims cached `content_html`, and clears `content_full_text` once chunks exist.

App-side flow (storage-efficient):

1. `lib/stortinget-detail-cache.ts` fetches or reads a sak detail.
2. `lib/stortinget-document-ingest.ts` parses document references and fetches
   viewable publication HTML from Stortinget.
3. Ready documents store a short `text_excerpt` only (no HTML cache). Text is
   chunked into `document_chunks` (`embedding_status = 'pending'`), then
   `content_full_text` / `content_html` are cleared so chunk text is the single copy.
4. `N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL` is triggered when new chunks are
   created.
5. The n8n embedding workflow fills `embedding vector(768)`, marks chunks
   `ready`, sets `chunks_status = ready`, and clears leftover document bodies.
6. Document viewer (`/api/sak/[id]/documents/[docId]/content`) fetches HTML live
   from Stortinget when no legacy `content_html` cache exists.

**Egress:** List/sync/overlay queries must not select full `detail_json`.
Use denormalized columns + live list overlays. n8n AI-summary SQL projects a
trimmed detail context instead of the full JSON blob.

**Important:** n8n is not a vector store. RAG requires embeddings in Postgres
(`match_issue_document_chunks`). Moving chunk *blobs* into n8n would break
similarity search.

If the DB hits `exceed_db_size_quota`, reclaim with:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/reclaim-document-storage.sql
# or: select * from public.reclaim_document_body_storage();
```

Backfill recent cached saker:

```bash
npx tsx scripts/backfill-sak-documents.ts 10
```
