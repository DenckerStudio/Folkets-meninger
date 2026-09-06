## Learned User Preferences

- Prefer minimal, focused fixes that unblock builds/CI.
- When asked to commit/push, stage only intended changes and exclude unrelated artifacts.
- Prefer working on informatively named branches with prefix `cursor/`.
- Avoid user-visible mock/placeholder data; prefer honest empty/“coming soon” states.
- Forum is removed from the product. System-generated Reels live under
  Avstemninger (`/dashboard/avstemninger/reels`) as ja/nei/blank polls. Landing
  after login / `/dashboard` is `utforsk`.
  Primary nav: Utforsk / Avstemninger / Høringer. Default Stortinget period is
  `2025-2029`. Auth is email/password and Google OAuth via Supabase — do not
  mention BankID, MinID, or electronic ID verification in user-facing copy.
  Opt-in `activity_visibility` (`private`|`summary`|`full`). Admin via
  `user_roles` + `is_admin()` (`lib/admin/gate.ts`). Plan/history:
  `infra/coolify/README.md`, subagent `.cursor/agents/forum-removal-egress.md`.

## Learned Workspace Facts

- Single Next.js App Router app (Next.js 15).
- Auth and DB are Supabase (Postgres); app uses SSR cookies/middleware refresh patterns.
- Stortinget data comes from `data.stortinget.no` (public API): saker,
  publications, questions, and høringer.
- AI summaries are produced externally via n8n + Ollama and stored in Supabase; the app
  should not assume Gemini for current summary generation.
- The repo expects validation via `npm run lint` and `npm run build`; no broad automated test suite assumed in workflows.
- First-time env setup: copy `.env.example` to `.env.local` before `npm run dev` or `npm run build`.
  For the Folkets-Stemme test Supabase, prefer `npm run env:test` (writes `.env.local` from `.env.test`).
 Local Docker Supabase uses `supabase/config.toml` + `npm run supabase:start`.
- Theme tokens live in `app/globals.css` (`background`/`foreground`/`card`/`muted`/`brand`). Prefer
 semantic classes (`bg-card`, `text-muted-foreground`, `border-border`, `text-brand`) over hard-coded
 gray/white so light and dark mode stay consistent.

## Architecture Map

```text
Next.js App Router
  app/                 public pages, dashboard, API routes, cron endpoints
  components/          UI components for saker, profile, valgomat, dashboard
  lib/                 Stortinget clients, Supabase clients, notifications, identity/admin
  supabase/migrations/ Postgres schema, RLS, RPCs, triggers
  workflows/n8n/       External automation for AI summaries, embeddings, cron,
                       and system poll (Reels) drafts
                       (archived forum pipelines under workflows/n8n/archive/forum/)
```

External systems:

- Supabase Auth stores user sessions; middleware refreshes cookies and protects
  `/dashboard/*` except public sak, politiker, avstemning, and initiativ pages.
- Supabase Postgres stores sak votes, poll ballots, citizen initiatives, hearing
  comments, notifications, AI summaries, Stortinget issue cache, document chunks,
  and admin data.
- Stortinget APIs are read-only sources for sak lists/details, høringer, and
  publications.
- n8n calls app cron endpoints with `x-cron-secret` and receives fire-and-forget
  webhooks from the app for AI summaries, document embeddings, and system poll drafts.
- Ollama generates AI summaries and embeddings from n8n, not from the app.

## Environment Variables

The canonical template is `.env.example`.

| Variable | Used for |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/server Supabase client setup. Test defaults: `.env.test` → Folkets-Stemme (`qetckokgtzbpunbzslfp`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only DB writes, RPCs, admin reads, document ingest, voting |
| `CRON_SECRET` | Protects `/api/cron/*` endpoints; n8n sends it as `x-cron-secret` |
| `N8N_AI_SUMMARY_WEBHOOK_URL` | Trigger missing sak AI summaries |
| `N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL` | Trigger pending document chunk embeddings |
| `N8N_HEARING_INNSPILL_WEBHOOK_URL` | Trigger n8n packaging of motforslag hearing reports |
| `N8N_SYSTEM_POLL_DRAFT_WEBHOOK_URL` | Trigger n8n system-poll (Reels) draft generation from sak RAG |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Notification and welcome email delivery |
| `STORTINGET_SESSION_ID`, `STORTINGET_PERIODE_ID` | Server defaults for Stortinget data |
| `NEXT_PUBLIC_STORTINGET_SESSION_ID`, `NEXT_PUBLIC_STORTINGET_PERIODE_ID` | Client-visible Stortinget defaults |
| `DISABLE_HMR` | Dev-only escape hatch for HMR issues |

## Current Subsystems and Runbooks

### Stortinget sync and sak cache

- `GET /api/cron/sync-issues` calls `lib/stortinget-sync.ts`; n8n schedules it
  in `workflows/n8n/app-cron.workflow.ts`. The result includes `upserted`,
  `total`, `newIssueIds`, `aiSummaryTriggered`, and `detailsRefreshed`.
- `lib/sak-status.ts` is the source of truth for "Under behandling" vs
  "Ferdigbehandlet"; it merges detail `ferdigbehandlet`, denormalized DB state,
  fresh list `status`, and `innstilling_*` hints because Stortinget list/detail
  exports can drift.
- List/sync/overlay queries must **not** select full `detail_json` (egress).
  Prefer denormalized `ferdigbehandlet`/`status` plus live list overlays; reserve
  full `detail_json` for sak detail pages and AI source builds.
- `lib/stortinget-saker-cache.ts` serves the list from 30-minute memory cache,
  30-minute `unstable_cache` DB reads, optional live list status overlays, and
  live Stortinget fallback. `getSakerWithCache()` returns `[]` during
  `NEXT_PHASE=phase-production-build`.
- `lib/stortinget-detail-cache.ts` stores detail JSON in `stortinget_issues` with
  a 24-hour max age and refreshes stale pending details.
- Detail refresh computes `sak_kind`, `henvisning`, `dokumentgruppe`,
  `ferdigbehandlet`, and `voting_closes_at`, then triggers missing AI summaries
  and document ingest.
- `refreshSakStatusOnly` powers one-off metadata repair without AI/doc side
  effects: `npx tsx scripts/backfill-sak-status.ts --pending-only`.
- Sak treatment labels use `lib/sak-status.ts`, not a single raw Stortinget
  field. `resolveSakStatusFromSources` prefers `detail_json.ferdigbehandlet`
  over the denormalized DB column, then merges numeric Stortinget status and
  list `innstilling` fields.
- Known Stortinget quirk: list exports can keep `status=1` while a sak is
  finished. Treat `innstilling_id > 0` with `innstilling_kode` 1 or 2 as a
  finished-sak hint when no explicit `ferdigbehandlet` boolean is available.
- If list and detail pages disagree between "Under behandling" and
  "Ferdigbehandlet", inspect `stortinget_issues.detail_json`,
  `ferdigbehandlet`, and fresh list-export innstilling fields. Repair DB drift
  with `supabase/migrations/20260702160000_backfill_ferdigbehandlet_from_detail.sql`
  or the backfill script above.

### Høringer

- `/dashboard/horinger` and `/dashboard/horinger/<id>` show Stortinget hearings;
  `/horinger` redirects to the dashboard path. These routes are login-gated by
  middleware, unlike public `/dashboard/sak/<id>` pages.
- `lib/stortinget-horinger.ts` fetches
  `https://data.stortinget.no/eksport/horinger?format=json` with a 1-hour
  revalidate and normalizes Stortinget date values.
- Stortinget may send sentinel dates (`/Date(-62135596800000)/` or
  `01.01.0001`) when no deadline is published. Treat them as missing dates, not
  real future/past deadlines.
- Hearing status kinds are `open`, `planned`, `held`, and `cancelled`, derived
  from `horing_status` plus innspill/application/session dates.
- Local hearing comments are public rows in `hearing_comments`; the app posts
  via `POST /api/hearings`, which calls `create_hearing_comment` with the
  service role. The RPC enforces `first_name`/`last_name` via
  `user_has_public_identity`; comments are not submitted to Stortinget.

### Voting lifecycle

- `lib/sak-voting-window.ts` derives the next voting deadline from saksgang
  events such as `VOT`, `VEDTAK`, `BEHS`, and related treatment events.
- If every vote-close event date is in the past, the sak is closed. Missing
  vote-close events still leave the window open (unless `ferdigbehandlet`).
- `app/api/vote/route.ts` rejects votes when the issue is closed,
  `ferdigbehandlet` is true, or `voting_closes_at` has passed.
- `voting-section.tsx` must not reopen a ballot when the server already sent
  `votingClosed: true`.
- `supabase/migrations/20260618120000_sak_voting_status.sql` enforces the same
  closure rules in the `cast_vote` RPC.
- Sak ballots stay For/Mot/Avstår. Public Ja/Nei/Blank language is polls only.

### Avstemninger and borgerinitiativ

- Dual-track polls live in `polls` (`stortinget` | `citizen` | `system`) with
  anonymous `poll_votes` and encrypted `poll_vote_receipts`. Ballot choices:
  `ja`/`nei`/`blank`.
- Citizen initiatives are title/body only (no forum, no top-arguments). Default
  support threshold is 500. Schema:
  `supabase/migrations/20260819210000_direct_democracy_polls.sql` plus
  `20260821130000_system_poll_reels.sql` for system Reels.
- Public routes: `/dashboard/avstemninger`, `/dashboard/avstemninger/reels`,
  `/dashboard/avstemninger/<id>`, `/dashboard/initiativ`, `/dashboard/initiativ/<id>`.
  Voting and endorsements require login. Empty lists are honest — do not seed mock polls.
- System Reels are AI-generated ja/nei/blank questions from sak RAG (n8n + Ollama),
  stored as `polls` drafts (`track=system`) and published by admin. Copy must state
  they are system-generated. Do not use `ensure_stortinget_poll` for drafts (it opens
  immediately); use `create_system_poll_draft` → `publish_poll`.
- Fylke breakdowns use `users.fylke_code` only when `fylke_verified` is true.
  Self-declared fylke via the profile picker does not set `fylke_verified`.
- Primary nav: Utforsk / Avstemninger / Høringer. Post-login fallback is Utforsk.

### Identity, activity, admin

- Public first/last name required for hearing comments and creating initiatives
  (`user_has_public_identity`); `/auth/complete-profile` collects missing names.
- Public activity is opt-in via `users.activity_visibility` (`private` default).
- Admin access: `public.user_roles` (`role = 'admin'`) via `lib/admin/gate.ts`
  (`is_admin()`). Grant/revoke with `grant_app_role_by_email` /
  `revoke_app_role_by_email` (service role) or `/dashboard/admin/reels`.
  Remaining admin surface: `/dashboard/admin/statistikk`, `/dashboard/admin/reels`.
- Do not mention BankID, MinID, or electronic ID verification anywhere in
  user-facing copy, roadmap items, or marketing text.

### Document ingest and RAG

- `lib/stortinget-document-ingest.ts` parses sak documents, fetches publication
  HTML where available, stores a short excerpt (no HTML cache), writes pending
  `document_chunks`, then clears `content_full_text` so chunk text is the single copy.
- New chunks fire `N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL`; n8n embeds pending
  chunks in Postgres pgvector (required for RAG — n8n is not a vector store)
  and marks them ready for `match_issue_document_chunks`.
- Viewer HTML is fetched live from Stortinget via
  `/api/sak/[id]/documents/[docId]/content` when no legacy `content_html` exists.
- If DB hits size quota: `scripts/reclaim-document-storage.sql` or
  `reclaim_document_body_storage()`.
- Backfill recent cached issues with `npx tsx scripts/backfill-sak-documents.ts 10`.

### Konsekvens-kalkulator and samsvars-score

- Sak page (`/dashboard/sak/<id>`) shows **Hva betyr saken for deg?** after the AI
  summary. Anonymous fylke/housing/car/occupation stay in localStorage
  (`folkets:impact:profile`). `POST /api/sak/[id]/impact` retrieves document
  chunks (no embeddings column — egress) plus the AI summary and synthesizes a
  personal effect. Kroner amounts are shown only when they appear in the source.
- **Folkets vilje vs. Stortinget** sits after the ballot. It fetches
  `data.stortinget.no/eksport/voteringer?sakid=` (1h revalidate), picks a
  substantive votering, and scores gap vs app `get_issue_vote_totals`.
  `ALIGNMENT_MIN_FOLK_VOTES = 5` before claiming folkets vilje. Pending saker
  get an honest “Stortinget har ikke votert ennå” state.

### Notifications and cron

- Notifications use `notification_preferences`,
  `notification_category_subscriptions`, and `notifications`.
- Channels in UI: `categories`, `labels` (forum/mentions removed).
- `/api/cron/digest?frequency=daily|weekly` sends digest emails with SMTP env
  vars and advances `last_digest_sent_at_by_channel`.
- `/api/cron/categories`, `/api/cron/sync-issues`, and
  `/api/cron/package-counter-proposals` are also protected by `CRON_SECRET`.

### Kunnskapspoeng, merker og motforslag

- Knowledge points reuse `award_user_points` (not forum likes). Awards:
  quiz pass (+15), document read after 8s in the viewer (+5), constructive
  motforslag (+20) or hearing comment (+10).
- Badges: Informert borger (1 quiz), Saksforsker (3 document reads),
  Fylkesekspert (self-declared `users.fylke_code` + 1 quiz). `fylke_verified`
  stays false for self-declared fylke.
- In-app knowledge quiz is grounded in sak title/summary/komité/AI summary.
  Typebot is not wired; the same award path can later accept an external
  webhook.
- Motforslag live on the sak page (`counter_proposals`). Threshold default 10.
  When reached, the app packages a Markdown/JSON report and fires
  `N8N_HEARING_INNSPILL_WEBHOOK_URL`. This is **not** a Stortinget submit API —
  official innspill still goes via stortinget.no. Schema:
  `supabase/migrations/20260822120000_knowledge_and_counter_proposals.sql`.

### Admin, stats, and valgomat

- Government stats exports are available under the admin stats route and apply
  `GOVERNMENT_STATS_MIN_VOTES = 50` before publishing aggregate vote rows.
- Valgomat party alignment is intentionally disabled until Stortinget per-party
  voting data exists (`PARTY_ALIGNMENT_AVAILABLE = false`).

## Documentation Locations

- Start with `README.md` for setup and repository orientation.
- Update `supabase/README.md` for schema, RLS, RPCs, migrations, and DB repair
  notes.
- Update `workflows/n8n/README.md` for workflow IDs, node settings, webhook
  payloads, and deployment/runbook notes. Forum workflows live under
  `workflows/n8n/archive/forum/` (inactive).
- Alternativ C / egress + forum-removal plan: `infra/coolify/README.md`.
- Keep subsystem runbooks co-located; avoid adding a new docs tree unless a topic
  no longer fits an existing README.

## Cursor Cloud specific instructions

- Package manager is npm (only `package-lock.json`). The update script runs `npm ci`, so dependencies are already installed at session start. Scripts live in `package.json`: `dev`, `build`, `lint`, `test:unit`, `test:e2e`.
- Supabase credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are provided as Cloud Agent secrets / env vars and point at a real hosted project with all `supabase/migrations/*.sql` applied (voting `vote_encryption_secret` pepper is configured). Browser-side auth from the in-VM Chrome reaches Supabase fine — the full auth/voting flow works end-to-end.
- **`.env.local` is still required to run the dev server**, because it carries the non-secret `STORTINGET_*` / `NEXT_PUBLIC_STORTINGET_*` defaults (and `middleware.ts` builds a Supabase client on every request, so the `NEXT_PUBLIC_SUPABASE_*` values must be resolvable or every page 500s). It is gitignored; recreate with `npm run env:test` (Folkets-Stemme test Supabase) or from `.env.example` if absent. Next.js reads injected `process.env` with higher precedence than `.env.local`, so the injected secrets win even if `.env.local` holds older values.
- Playwright and CI use the Folkets-Stemme test Supabase from `.env.test` / workflow `env` (anon key only). Set `SUPABASE_SERVICE_ROLE_KEY` via secrets when server RPCs are needed.
- Auth is email/password (`supabase.auth.signUp` / `signInWithPassword`). **Email signups require confirmation**, so a raw signup does NOT create a session. To get a usable test login, create a pre-confirmed user with the admin API and the service role key, then sign in: `POST {SUPABASE_URL}/auth/v1/admin/users` with `{"email":...,"password":...,"email_confirm":true,"user_metadata":{...}}` (the project rejects `@example.com`; use e.g. `@gmail.com`).
- `/dashboard/*` is gated by middleware (redirects to `/auth/login`) except public
  issue pages `/dashboard/sak/<id>`, politician pages, `/dashboard/avstemninger`
  (and `/<id>`), and `/dashboard/initiativ` (and `/<id>`). Issue pages fetch live
  `data.stortinget.no` data and can take 10–30s on first load.
- Hello-world that exercises core functionality: log in, then open an issue (`/dashboard/sak/<id>`) and cast a "For" vote in the "Hva mener du?" section — the vote persists and the `/dashboard/min-side` vote count updates.
- `npm run test:unit` shells out to `npx tsx ...`; the first run downloads `tsx` (needs network) and then caches it.
