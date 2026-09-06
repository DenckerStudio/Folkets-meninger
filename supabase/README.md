# Supabase migrations and schema runbook

Supabase backs auth-adjacent user state, anonymous voting receipts, hearing
comments, notifications, Stortinget issue caches, AI summary data, and document
RAG tables. Forum tables/RPCs were removed in
`20260810120000_remove_forum_and_activity_visibility.sql` (no data export).
Users may opt in to public activity via `users.activity_visibility`.

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
| AI summaries | `20260528120000_issue_ai_summaries.sql`, `20260529120000_simplify_issue_ai_summaries.sql`, `20260608120000_issue_ai_summaries_v2.sql`, `20260823210000_n8n_ai_summary_rich_context.sql` | `issue_ai_summaries` legacy + v2 fields (`narrative`, `who_affected`, `how_affected`, `topic_cards`, `labels`), `n8n_get_issue_ai_summary_context`, `n8n_upsert_issue_ai_summary` |
| Auth/user sync + public identity | `20260529150000_users_auth_sync.sql`, `20260601120000_forum_public_identity.sql`, `20260810120000_remove_forum_and_activity_visibility.sql` | `users`, `ensure_public_user`, `user_has_public_identity`, `update_user_profile_names`, `activity_visibility`, `hearing_comments`, `create_hearing_comment` |
| Removed forum history | `20260530120000_forum_enhancements.sql` through `20260621120000_forum_sak_rag_prompts.sql`, then `20260810120000_remove_forum_and_activity_visibility.sql` | Historical `forum_*` tables/RPCs are dropped; keep only the `user_has_forum_identity` compatibility wrapper |
| Marketing feedback | `20260806140000_site_feedback.sql` | `site_feedback` (public “Gi innspill” form; service-role writes only) |
| Stortinget sak metadata | `20260616120000_stortinget_issue_sak_kind.sql`, `20260618140000_stortinget_issues_category.sql`, `20260702160000_backfill_ferdigbehandlet_from_detail.sql` | `sak_kind`, `henvisning`, `dokumentgruppe`, `category`, `ferdigbehandlet` repair |
| Sak documents/RAG | `20260617120000_sak_documents_rag.sql`, `20260807112603_document_chunks_storage_efficiency.sql`, `20260823200000_n8n_postgrest_rpcs.sql` | `stortinget_issue_documents`, `document_chunks`, `chunks_status`, `match_issue_document_chunks`, n8n RPC wrappers, reclaim helpers |
| Direct-democracy polls | `20260819210000_direct_democracy_polls.sql`, `20260821130000_system_poll_reels.sql` | `norway_counties`, `polls` (`stortinget`/`citizen`/`system`), `poll_votes`, `poll_vote_receipts`, `citizen_initiatives`, `citizen_initiative_endorsements`, Ja/Nei/Blank RPCs, system Reels drafts |
| App RBAC | `20260821120000_app_rbac_user_roles.sql` | `app_roles`, `user_roles`, `is_admin()`, `grant_app_role_by_email`, `revoke_app_role_by_email` |
| Knowledge + motforslag | `20260822120000_knowledge_and_counter_proposals.sql` | `user_knowledge_quiz_passes`, `user_document_reads`, `user_badges`, `counter_proposals`, `counter_proposal_endorsements`, package RPCs |

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
If all such event dates are in the past, the window is closed (do not treat
“no future VOT” as still open). Repair stale status/deadline data with:

```bash
npx tsx scripts/backfill-sak-status.ts --pending-only --concurrency 8
```

### Advisory polls (Ja/Nei/Blank)

`20260819210000_direct_democracy_polls.sql` adds Swiss-inspired dual-track polls
and citizen initiatives **without** forum coupling (no `forum_thread_id`, no
top-arguments RPC). `20260821130000_system_poll_reels.sql` adds `track=system`
(Reels) with `generation_metadata` and draft → publish RPCs.

| Table | Purpose |
|-------|---------|
| `polls` | `stortinget`, `citizen`, or `system` track; public when `status` is `open` or `closed` |
| `poll_votes` | Anonymous ballots (`ja`/`nei`/`blank` + optional verified `fylke_code`) |
| `poll_vote_receipts` | One encrypted receipt per user per poll |
| `citizen_initiatives` | Title/body only; default support threshold 500 |
| `norway_counties` | 15 fylker after the 2024 reform |

System Reels are AI-generated ja/nei/blank questions. n8n inserts drafts via
`create_system_poll_draft`; admins publish with `publish_poll` or archive with
`archive_poll`. Do not call `ensure_stortinget_poll` for AI drafts (it opens the
poll immediately). Coverage helpers: `get_sak_poll_coverage()`,
`get_sak_poll_candidates()`.

Fylke is attached only when `users.fylke_verified` is true.
`apply_verified_fylke_claim` is service-role only and not wired in the app.
Do not seed mock polls; empty UI is the honest launch state.

## Stortinget issue cache

`stortinget_issues` is both the list cache and the anchor table for votes,
summaries, system poll drafts, documents, and government stats.

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
`user_has_public_identity`, trims bodies, and accepts 1-10000 characters. These
comments are not official submissions to Stortinget; the detail page labels them
as public app comments. Constructive comments can award knowledge points through
`app/api/hearings/route.ts`, `hearingCommentAward`, and `syncUserBadges`.

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

## Public identity, activity, and admin roles

The forum-specific identity helper was renamed during forum removal. Current app
code should use `user_has_public_identity` / `PUBLIC_IDENTITY_ERROR`; the older
`user_has_forum_identity` SQL and TypeScript exports remain as compatibility
wrappers only. Public first and last name are required for user-published
surfaces such as høring comments and borgerinitiativ.

Forum tables, forum moderation RPCs, trusted-source tables, forum prompt tables,
and forum point triggers are removed by
`20260810120000_remove_forum_and_activity_visibility.sql`. Do not write new code
against `forum_*` objects. Historical n8n/forum notes live under
`workflows/n8n/archive/forum/`.

`users.activity_visibility` is opt-in and defaults to `private`; it may be
`private`, `summary`, or `full`, and must not expose vote choices.

Admin pages use `lib/admin/gate.ts`, which reads `public.user_roles` (`role =
'admin'`). `is_admin()` is the SQL helper. Env allowlists (`ADMIN_EMAILS` /
`FORUM_ADMIN_EMAILS`) are removed.

Bootstrap the first admin in the SQL editor (service role / postgres):

```sql
SELECT public.grant_app_role_by_email('you@example.com', 'admin', NULL);
```

Further grant/revoke: `/dashboard/admin/reels` or the same RPCs. JWT
`app_metadata.role` is synced for compatibility; `user_roles` is the source of
truth.

## Notifications

`20260528000003_notifications.sql` creates:

- `notification_preferences`: per-user email enablement and frequency by channel
  (legacy rows may still contain `forum`/`mentions`; current app channels are
  `categories` and `labels`).
- `notification_category_subscriptions`: "hjertesaker" category subscriptions.
- `notifications`: in-app inbox rows with optional email delivery metadata.

Users can read/update their own preferences and inbox rows through RLS. Inserts
are server-side (`service_role`) via `lib/notifications.ts`. Digest delivery is
handled by `GET /api/cron/digest?frequency=daily|weekly` and needs SMTP env vars
from `.env.example`.

## Document ingest and RAG

`20260614130000_forum_profiles_points_ai_sources.sql` introduced
`stortinget_issue_documents` before the later forum cleanup;
`20260617120000_sak_documents_rag.sql` adds cached HTML/text fields,
`document_chunks`, pgvector, and `match_issue_document_chunks`.
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

The sak impact calculator (`POST /api/sak/[id]/impact`) reads `document_chunks.content`
(never the `embedding` column) plus `issue_ai_summaries` and only surfaces kroner
amounts that appear in those sources.

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
