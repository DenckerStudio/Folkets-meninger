## Learned User Preferences

- Prefer minimal, focused fixes that unblock builds/CI.
- When asked to commit/push, stage only intended changes and exclude unrelated artifacts.
- Prefer working on informatively named branches with prefix `cursor/`.
- Avoid user-visible mock/placeholder data; prefer honest empty/“coming soon” states.

## Learned Workspace Facts

- Single Next.js App Router app (Next.js 15).
- Auth and DB are Supabase (Postgres); app uses SSR cookies/middleware refresh patterns.
- Stortinget data comes from `data.stortinget.no` (public API).
- AI summaries and forum prompts are produced externally via n8n + Ollama and stored in Supabase; the app should not assume Gemini for current summary generation.
- Forum Reels: n8n workflow `MloIdsnX7FozM4dv`; `forum_trusted_sources` (unknown domain -> `draft`); votes Ja/Nei/Ikke interessert + separate discuss CTA.
- The repo expects validation via `npm run lint` and `npm run build`; no broad automated test suite assumed in workflows.
- `.env.local` setup: copy `.env.example` to `.env.local` before starting the dev server.

## Architecture Map

```text
Next.js App Router
  app/                 public pages, dashboard, API routes, cron endpoints
  components/          UI components for saker, forum, profile, valgomat
  lib/                 Stortinget clients, Supabase clients, forum services, notifications
  supabase/migrations/ Postgres schema, RLS, RPCs, triggers
  workflows/n8n/       External automation for AI summaries, forum prompts, embeddings, cron
```

External systems:

- Supabase Auth stores user sessions; middleware refreshes cookies and protects
  `/dashboard/*` except public sak pages.
- Supabase Postgres stores votes, forum content, notifications, AI summaries,
  Stortinget issue cache, document chunks, and admin/trusted-source data.
- Stortinget APIs are read-only sources for sak lists/details/publications.
- n8n calls app cron endpoints with `x-cron-secret` and receives fire-and-forget
  webhooks from the app for AI summaries and document embeddings.
- Ollama generates AI summaries/prompts and embeddings from n8n, not from the app.

## Environment Variables

The canonical template is `.env.example`.

| Variable | Used for |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/server Supabase client setup |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only DB writes, RPCs, admin reads, document ingest, voting |
| `CRON_SECRET` | Protects `/api/cron/*` endpoints; n8n sends it as `x-cron-secret` |
| `N8N_AI_SUMMARY_WEBHOOK_URL` | Trigger missing sak AI summaries |
| `N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL` | Trigger pending document chunk embeddings |
| `N8N_FORUM_PROMPTS_WEBHOOK_URL` | Trigger forum prompt generation |
| `FORUM_ADMIN_EMAILS` | Comma-separated forum/admin allowlist in addition to `app_metadata.role=admin` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Notification and welcome email delivery |
| `STORTINGET_SESSION_ID`, `STORTINGET_PERIODE_ID` | Server defaults for Stortinget data |
| `NEXT_PUBLIC_STORTINGET_SESSION_ID`, `NEXT_PUBLIC_STORTINGET_PERIODE_ID` | Client-visible Stortinget defaults |
| `DISABLE_HMR` | Dev-only escape hatch for HMR issues |

## Current Subsystems and Runbooks

### Stortinget sync and sak cache

- `GET /api/cron/sync-issues` calls `lib/stortinget-sync.ts`; n8n schedules it
  in `workflows/n8n/app-cron.workflow.ts`.
- `lib/stortinget-detail-cache.ts` stores detail JSON in `stortinget_issues` with
  a 6-hour max age and refreshes stale pending details.
- Detail refresh computes `sak_kind`, `henvisning`, `dokumentgruppe`,
  `ferdigbehandlet`, and `voting_closes_at`, then triggers missing AI summaries
  and document ingest.
- One-off status repair: `npx tsx scripts/backfill-sak-status.ts --pending-only`.

### Voting lifecycle

- `lib/sak-voting-window.ts` derives the next voting deadline from saksgang
  events such as `VOT`, `VEDTAK`, `BEHS`, and related treatment events.
- `app/api/vote/route.ts` rejects votes when the issue is closed,
  `ferdigbehandlet` is true, or `voting_closes_at` has passed.
- `supabase/migrations/20260618120000_sak_voting_status.sql` enforces the same
  closure rules in the `cast_vote` RPC.

### Forum

- Human thread/reply creation requires `first_name` and `last_name` via
  `user_has_forum_identity`; `/auth/complete-profile` collects missing names.
- Moderation is layered: TypeScript validation/sanitization in `lib/forum/*`,
  plus DB-side `forum_moderation_check` inside create-thread/create-reply RPCs.
- Points are awarded by DB triggers: thread +10, reply +5, like given +1, like
  received +2, vote cast +3.
- Reports are stored in `forum_reports`; admin pages live under
  `/dashboard/admin/forum-reports` and require `requireForumAdmin()`.
- Forum prompt source governance lives in `forum_trusted_sources`; unknown source
  domains are routed to draft by the n8n forum prompt workflow.

### Document ingest and RAG

- `lib/stortinget-document-ingest.ts` parses sak documents, fetches publication
  HTML where available, stores plain text/HTML in `stortinget_issue_documents`,
  and writes pending `document_chunks`.
- New chunks fire `N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL`; n8n embeds pending
  chunks and marks them ready for `match_issue_document_chunks`.
- Backfill recent cached issues with `npx tsx scripts/backfill-sak-documents.ts 10`.

### Notifications and cron

- Notifications use `notification_preferences`,
  `notification_category_subscriptions`, and `notifications`.
- `/api/cron/digest?frequency=daily|weekly` sends digest emails with SMTP env
  vars and advances `last_digest_sent_at_by_channel`.
- `/api/cron/categories` and `/api/cron/sync-issues` are also protected by
  `CRON_SECRET`.

### Admin, stats, and valgomat

- Forum/admin access checks `FORUM_ADMIN_EMAILS` first, then Supabase
  `app_metadata.role === "admin"`.
- Government stats exports are available under the admin stats route and apply
  `GOVERNMENT_STATS_MIN_VOTES = 50` before publishing aggregate vote rows.
- Valgomat party alignment is intentionally disabled until Stortinget per-party
  voting data exists (`PARTY_ALIGNMENT_AVAILABLE = false`).

## Documentation Locations

- Start with `README.md` for setup and repository orientation.
- Update `supabase/README.md` for schema, RLS, RPCs, migrations, and DB repair
  notes.
- Update `workflows/n8n/README.md` for workflow IDs, node settings, webhook
  payloads, and deployment/runbook notes.
- Keep subsystem runbooks co-located; avoid adding a new docs tree unless a topic
  no longer fits an existing README.
