# AGENTS.md — Folkets Meninger

Agent-facing facts and rules. Keep it current; prefer short bullets. Details live in
co-located READMEs (see [Documentation](#documentation)).

## Hard rules (read first)

- **Nothing merges to `main` without Mathias' explicit yes.** Work on a branch
  (`cursor/…`), open a PR to `main`, keep CI green. No force-push to `main`.
- **Migrations are never auto-applied.** The Coolify Expert applies them manually,
  and only after Mathias says yes. Never edit a migration that is already applied.
  Write a new one.
- **Never put secrets in code, commits, PR text, or logs** (keys, `CRON_SECRET`,
  BYOK keys, service-role key, Stripe secrets).
- **Hosting is Coolify.** Vercel is no longer used for hosting. Do not propose
  moving back to Vercel.

### Product UI

- **All copy and UI text is Norwegian bokmål.** Do not ship English UI strings.
  Do not mention BankID, MinID, or electronic ID verification anywhere in
  user-facing copy, roadmap, or marketing.
- **No AI labels in the UI** (Mathias decided 2026-10-06): do not show «AI»
  badges or typical AI icons. Use animated icons instead.

- Avoid user-visible mock/placeholder data. Use honest empty or "kommer snart" states.
- Prefer minimal, focused changes. Stage only intended files.

## Product and domain

- Name: **Folkets Meninger**. Canonical site: `https://www.folkets-meninger.no`
  (`DEFAULT_SITE_URL` in `lib/seo/metadata.ts`).
- **Folkets Stemme / folkets-stemme.no is retired.** Do not use it in new copy or
  URLs. Legacy identifiers can still hold the old name (e.g. the n8n credential
  «Folkets Stemme Self-hosted»). Leave them unless the task is renaming them.
- The paid tier keeps the name **Stemme+** (59 kr/mnd, `lib/stemme-plus/constants.ts`).
- Primary nav: Folkets meninger / Utforsk / Høringer / Appens fremtid. Landing after
  login and `/dashboard` is Utforsk (`/dashboard/utforsk`). Forum is removed.
- Auth: email/password and Google OAuth via Supabase Auth.

## Hosting and infrastructure

All on **Coolify, server `klever`**:

| Service | What |
|---------|------|
| `fm-web` | This Next.js 15 App Router app. **Auto-deploys from `folkets-meninger:main`.** |
| `fm-cms` | Payload CMS 3 at `cms.folkets-meninger.no`, from `cms/` in this repo (`infra/coolify/cms.md`). Uses its own `payload` schema in the same Postgres. |
| `supabase-folkets` | Self-hosted Supabase (Postgres + Auth + PostgREST), the production DB. |
| n8n, Ollama, SearXNG | Automation, local LLMs, and search for chat (`infra/searxng/`). |

- `infra/coolify/README.md` holds the older Alternativ C / forum-removal plan
  (historical; it still talks about hosted Supabase and Vercel env).
- **Legacy Vercel bits still in the repo**: `npm run vercel:env:supabase`
  (`scripts/sync-vercel-supabase-env.mjs`) and Vercel mentions in `.env.example`.
  Treat them as legacy. Do not build on them.

## Database rules (Supabase / Postgres)

- Schema lives in `supabase/migrations/`; repair snippets live in `supabase/hotfix/`.
  Both are applied **manually** by the Coolify Expert, only with Mathias' yes.
- After the 2026-10-18/19 lockdown, **every new function, table, or view needs
  explicit privileges**:
  - `REVOKE ALL … FROM PUBLIC, anon, authenticated`, then `GRANT` only what's needed.
  - New tables: `ENABLE ROW LEVEL SECURITY`. No `USING (true)` / `WITH CHECK (true)`
    policies for `anon`/`authenticated`/`public`.
  - **`n8n_*` RPCs → `service_role` only** (n8n's credential uses the service-role key).
  - Never grant `anon` (or `authenticated`) anything on the `payload` schema; it belongs to `fm-cms` only.
- **User-bound `SECURITY DEFINER` RPCs** must bind the caller: use `auth.uid()` or
  `PERFORM assert_rpc_caller_is_user(p_user_id)`. Admin RPCs use
  `require_admin_user_id(...)`. **Never trust `p_user_id` / `p_admin_user_id` from a
  client.** The app calls these RPCs server-side with **`service_role`**, passing the
  session user's id after it has checked auth (`requireAdmin()` for admin routes).
- The browser client must not `.rpc()` user-bound or admin RPCs. The only exception
  is `get_public_user_displays` (names only).
- **CI must be green** (`.github/workflows/ci.yml`):
  - `lint-and-build`: `npm run lint` + `npm run build`
  - `db-security`: `scripts/run-prod-like-db-security.sh` (prod-like chain; uses
    `supabase/tests/security-guard.sql` and its allowlist, see `docs/security-allowlist.md`)
  - `migration-sql-lint`: `scripts/check-migrations.mjs` on changed migrations
    (REVOKE pattern, RLS, open policies)
  - Locally: `scripts/run-local-db-security.sh` / `scripts/run-prod-like-db-security.sh`.
- Prod is **half-migrated**. `run-prod-like-db-security.sh` skips `20261018140000`,
  `…150000`, and `…160000` and defers `20261020120000`–`20261020130000`. Check that
  script and ask before assuming what prod has applied.
- **2026-10-19 incident**: anon/authenticated could call `SECURITY DEFINER` RPCs that
  take `p_user_id`, so callers could impersonate other users. Public anon could also
  call `n8n_*` RPCs. The fix: hotfix `supabase/hotfix/20261019_revoke_impersonation.sql`,
  migrations `20261020110001` (session actor / RBAC), `20261020120000`
  (`assert_rpc_caller_is_user`), `20261020120001`/`120002` (EXECUTE revokes),
  `20261020130000` (Postgres rate limits), and `20261020140000` (n8n lockdown).
  See `docs/SECURITY-AUDIT-2026-10-19.md` and `docs/SECURITY-SWEEP-2026-10-18.md`.
  Contract tests: `lib/rpc-caller-bindings.test.ts`, `lib/revoke-impersonation-rpc.test.ts`.
- **`20261018120000_blog_posts.sql` is superseded. Do not apply it** (see Blog).

## Integrations

- **Stortinget** (`data.stortinget.no`, read-only): saker, publications, questions,
  høringer, voteringer.
- **n8n** handles every scheduled and AI job. It calls app endpoints with header
  `x-cron-secret: $CRON_SECRET` (`/api/cron/*`, `/api/ops/*`) and receives
  fire-and-forget webhooks from the app. Its jobs:
  - sak flow: sync-issues → document embeddings → AI summaries → system-poll (Reels) drafts
  - GP / Reels drafts (`create_system_poll_draft` → admin `publish_poll`)
  - høringer packaging (`/api/cron/package-opinion-innspill` → `N8N_HEARING_INNSPILL_WEBHOOK_URL`)
  - blog drafts: `POST /api/ops/blog/drafts` (`verifyOpsSecret`, `x-cron-secret`) creates a
    Payload draft; `POST /api/ops/blog/social-posted` marks a Payload post as shared
  - pipeline health (`workflows/n8n/pipeline-health.workflow.ts`); errors go to
    `workflows/n8n/ops-error-handler.workflow.ts`; admin alerts use `POST /api/ops/n8n-notify`
- **Ollama** (via n8n, never from the app): target model `gemma4:26b`. Repo workflow
  configs still pin older ids (e.g. `gemma4:e2b-it-qat` in
  `workflows/n8n/system-poll-draft.shared.ts`; `qwen3:4b` / `nomic-embed-text` in
  `lib/trust/ai-transparency.ts`). Verify in n8n before changing anything.
- **Stripe**: Stemme+ checkout and webhook (`/api/webhooks/stripe`). The UI says
  "not configured" when `STRIPE_SECRET_KEY` / `STRIPE_STEMME_PLUS_PRICE_ID` are missing.
- **Bluesky**: blog posts are shared there. On publish `fm-cms` fires
  `BLOG_PUBLISHED_WEBHOOK_URL` (configured on `fm-cms`, not `fm-web`) and n8n posts.
- **X and Reddit are dropped for now.** Don't add integrations for them.
- SMTP for notifications and digests. SearXNG for Stemme+ chat source search.

## Blog

- **Payload CMS (`cms/`, Coolify `fm-cms`) is the source of truth for `/blogg`.**
  `lib/blog/service.ts` reads published posts from Payload via `lib/cms/payload-client.ts`
  (`Authorization: users API-Key <CMS_API_KEY>`, a `reader`-role Payload user). Routes:
  `/blogg`, `/blogg/[slug]`, `/blogg/side/[n]`, `/blogg/tema/[slug]`, `/blogg/rss.xml`.
  If `CMS_URL` / `CMS_API_KEY` are unset, the blog shows honest empty states.
- **n8n blog drafts go to Payload**: `POST /api/ops/blog/drafts` creates a draft
  (`_status: draft`, review state `til_vurdering`) with `CMS_AGENT_API_KEY` (`agent` role,
  falls back to `CMS_API_KEY`). Editors publish in the Payload admin, never n8n.
  `POST /api/ops/blog/social-posted` calls `fm-cms` `/api/blog-ops/social-posted`
  signed with HMAC (`REVALIDATE_SECRET`). `fm-cms` calls `/api/revalidate/blog` on publish.
  Blogg redigeres i Payload (`CMS_URL`/admin), ikke i fm-web admin-hub.
- **`20261018120000_blog_posts.sql` (Supabase `public.blog_posts`) is superseded and must
  still NOT be applied.** Do not build on the Supabase blog table. All blog work targets Payload.
- Setup and env: `infra/coolify/cms.md`, `cms/.env.example`. **`SERVER_URL`**
  must be the public CMS origin (`https://cms.folkets-meninger.no`); optional
  aliases `PAYLOAD_PUBLIC_SERVER_URL` / `NEXT_PUBLIC_SERVER_URL`. **`WEB_PUBLIC_URL`**
  is included in Payload `cors`/`csrf` with `SERVER_URL` (no wildcards). Admin
  login: per-account lockout (5 attempts / 15 min) plus IP+email throttle on
  `POST /api/users/login` (Traefik `X-Real-Ip` / rightmost `X-Forwarded-For`);
  API keys (`useAPIKey`) unchanged for agent/reader roles. Payload SQL migrations
  in `cms/src/migrations/` run automatically on **fm-cms** boot in production
  (`prodMigrations` + `instrumentation.ts`).

## Architecture map

```text
app/                 public pages, /dashboard, /blogg, API routes (/api/cron, /api/ops, /api/admin…)
components/          UI (saker, polls, profile, chat, blog, dashboard)
lib/                 Stortinget clients, Supabase clients, services, admin gate, rate limits
supabase/migrations/ schema, RLS, RPCs (manual apply)
supabase/hotfix/     one-off prod SQL (manual apply)
supabase/tests/      security guard / JWT smoke SQL used by db-security
workflows/n8n/       n8n workflows (forum pipelines archived in archive/forum/)
cms/                 Payload CMS 3 app (fm-cms): blog posts, categories, media, blog-ops endpoints
infra/               coolify/ (cms.md + historical plan), searxng/
```

## Subsystem notes

### Saker, stances, sync

- `GET /api/cron/sync-issues` → `lib/stortinget-sync.ts`, scheduled by
  `workflows/n8n/app-cron.workflow.ts`.
- `lib/sak-status.ts` decides "Under behandling" vs "Ferdigbehandlet". It merges
  detail `ferdigbehandlet`, DB state, list `status`, and `innstilling_*`. Quirk: list
  exports can keep `status=1` after a sak is finished. Treat `innstilling_id > 0` with
  `innstilling_kode` 1 or 2 as a finished-sak hint. Repair with
  `npx tsx scripts/backfill-sak-status.ts --pending-only`.
- **Egress:** list, sync, and overlay queries must not select full `detail_json`.
  Keep it for sak detail pages and AI source builds. List cache:
  `lib/stortinget-saker-cache.ts` (returns `[]` during build). Detail cache:
  `lib/stortinget-detail-cache.ts` (24 h).
- **Per-sak For/Mot/Avstår voting is retired**: `POST /api/vote` returns 410, and
  `cast_vote` is service_role only. Users mark a **stance** (`enig` / `uenig` /
  `ikke_interessert`) via `POST /api/stance` (`lib/stances/`). Public aggregates
  are k-anonymous (`STANCE_PUBLIC_MIN_ENGAGED`).
- **Folkets vilje vs. Stortinget**: `data.stortinget.no/eksport/voteringer`, needs at
  least `ALIGNMENT_MIN_FOLK_VOTES` (5).

### Polls / Reels (Utforsk)

- `polls` (`stortinget` | `system`; legacy `citizen` rows are hidden), anonymous
  `poll_votes`, encrypted receipts. Choices are `ja`/`nei`/`blank`. Voting requires login.
- System Reels are ja/nei/blank questions generated from sak RAG by n8n + Ollama.
  Use `create_system_poll_draft` → admin `publish_poll`, never
  `ensure_stortinget_poll` for drafts. Copy must say they are system-generated.
- Fylke breakdowns only count `users.fylke_code` when `fylke_verified` is true.

### Høringer

- `/dashboard/horinger[/<id>]` requires login. Fetched live from
  `data.stortinget.no/eksport/horinger` (`lib/stortinget-horinger.ts`). Treat sentinel
  dates (`/Date(-62135596800000)/`, `01.01.0001`) as missing.
- Local comments: `POST /api/hearings` → `create_hearing_comment`. Requires public
  first and last name. Comments are not sent to Stortinget.

### Folkets meninger (UGC) and innspill

- `/dashboard/folkets-meninger`: structured opinions plus one reply per user via
  `create_citizen_opinion` / `create_citizen_opinion_reply`. Sak filter: `?sak=<id>`.
- Opinion innspill (`lib/innspill/`): endorsement threshold 10, then
  `/api/cron/package-opinion-innspill` builds the package and calls n8n. This is not
  a Stortinget submit API.
- Reporting: `POST /api/opinions/report` → `report_content`.

### Identity, admin, Stemme+

- Admin: `public.user_roles` + `is_admin()` via `lib/admin/gate.ts`. Hub:
  `/dashboard/admin` (Appens fremtid, Oppfanget, Reels, Statistikk, Brukere, Stemme+).
- Public activity is opt-in (`users.activity_visibility`, `private` by default).
- Stemme+ (`users.subscription_tier`) gates BYOK AI chat (the orb overlay;
  `/dashboard/chat` only deep-links it). User LLM keys are encrypted in
  `user_llm_credentials` with `BYOK_ENCRYPTION_KEY`. Never log or return a key.
  Chat (`POST /api/chat`) uses the request session, not service_role.

### Appens fremtid

- `/dashboard/appens-fremtid`: forslag, endringslogg, veikart (`app_suggestions*`,
  `app_changelog_entries`, `app_roadmap_items`). Admins choose which forslag open for
  voting. Fider is not used by the app.

## Environment

Canonical template: `.env.example`. Key server-only vars: `SUPABASE_SERVICE_ROLE_KEY`,
`CRON_SECRET`, `N8N_*_WEBHOOK_URL`, `CMS_URL` / `CMS_API_KEY` / `CMS_AGENT_API_KEY` /
`REVALIDATE_SECRET` (blog, see `infra/coolify/cms.md`), `SMTP_*`,
`BYOK_ENCRYPTION_KEY`, `SEARXNG_BASE_URL`, `STRIPE_*`. Public:
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_STORTINGET_*`. Prod values live in Coolify, never in the repo.

## Local dev and validation

- npm only (`package-lock.json`). `.env.local` is required:
  `npm run env:test` (from `.env.test`) or copy `.env.example`. Local Docker Supabase:
  `npm run supabase:start`.
- Validate with `npm run lint`, `npm run build`, `npm run test:unit` (tsx; the first
  run downloads it), and `npm run test:e2e` (Playwright, `.env.test`).
- No `npm run eval` script on `main` yet (evals are on open PR #162).
- `/dashboard/*` is login-gated except sak, politiker, utforsk, avstemninger, and
  folkets-meninger pages. Sak pages fetch Stortinget live (10–30 s on a cold load).
- Test logins: email signups need confirmation. Create a pre-confirmed user via the
  Auth admin API (`email_confirm: true`) with the service role on a **test** project,
  never prod. `@example.com` is rejected.
- Theme: use semantic tokens from `app/globals.css` (`bg-card`,
  `text-muted-foreground`, `border-border`, `text-brand`), not hard-coded grays.

## Documentation

| File | Covers |
|------|--------|
| `README.md` | Setup and orientation |
| `supabase/README.md` | Schema, RPCs, migrations, DB runbooks |
| `workflows/n8n/README.md` | Workflow IDs, payloads, deployment |
| `docs/SECURITY-AUDIT-2026-10-19.md` | RPC/API security matrix, incident fixes |
| `docs/security-allowlist.md` | db-security allowlist |
| `infra/coolify/README.md` | Historical Alternativ C / forum-removal plan |
| `infra/searxng/README.md` | SearXNG for chat search |
