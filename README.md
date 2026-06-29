# Folkets Meninger

Next.js App Router application for Stortinget issue discovery, voting, forum discussion, public profiles, and Forum Reels. Supabase provides auth and Postgres storage; n8n + Ollama workflows generate AI summaries and forum prompt drafts outside the app.

## Architecture map

| Area | Main codepaths | Notes |
|------|----------------|-------|
| Stortinget data | `lib/stortinget*.ts`, `app/api/cron/sync-issues` | Uses `data.stortinget.no`; session defaults come from `STORTINGET_*` env vars. |
| Auth and profiles | `lib/supabase*.ts`, `middleware.ts`, `app/api/user/profile` | Supabase SSR cookies refresh through middleware. `/dashboard/*` requires login except public issue pages. |
| Voting | `app/api/vote`, `supabase/README.md` | Anonymous ballot table plus encrypted user receipt; aggregates come from RPCs. |
| Forum | `app/dashboard/forum`, `app/api/forum/*`, `supabase/migrations/*forum*` | Forum posts, moderation, points, profile display, and report/admin tools. |
| Forum Reels | `components/forum/*prompt*`, `app/api/forum/prompts`, `app/api/forum/reel-submit`, `workflows/n8n/` | n8n writes draft prompts; admins publish them. Public visibility is gated by `FORUM_REELS_PUBLIC`. |
| AI summaries and RAG | `lib/ai-summary`, `lib/trigger-*-webhook.ts`, `workflows/n8n/README.md` | The app reads Supabase summaries and triggers n8n webhooks when rows are missing. |

## Local setup

**Prerequisites:** Node.js and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Fill the Supabase values in `.env.local` (or provide them as shell env vars). The dev server also needs the non-secret Stortinget defaults from `.env.example`; without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, middleware will fail every request.

Common commands:

```bash
npm run lint
npm run build
npm run test:unit
npm run test:e2e
```

## Environment variables

| Variable | Required for | Notes |
|----------|--------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App, middleware, browser auth | Public Supabase project values. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side writes, points, cached Stortinget data, admin RPCs | Server-only; never expose to browser code. |
| `STORTINGET_SESSION_ID`, `STORTINGET_PERIODE_ID` | Stortinget fetches | Public mirrors use `NEXT_PUBLIC_STORTINGET_*`. |
| `CRON_SECRET` | n8n app cron | Sent as `x-cron-secret` to protected cron endpoints. |
| `N8N_AI_SUMMARY_WEBHOOK_URL`, `N8N_DOCUMENT_EMBEDDINGS_WEBHOOK_URL` | AI summary and document ingestion triggers | See `workflows/n8n/README.md`. |
| `N8N_FORUM_PROMPTS_WEBHOOK_URL`, `N8N_FORUM_SYNTHESIS_WEBHOOK_URL`, `N8N_FORUM_RSS_WEBHOOK_URL` | Forum prompt workflows | v5 is the primary draft pipeline; v12 is optional Regjeringen RSS + prompt generator. |
| `FORUM_ADMIN_EMAILS` | Forum admin pages and admin-only previews | Comma-separated email allowlist. |
| `FORUM_REELS_PUBLIC` | Forum Reels rollout | Defaults to admin-only preview unless exactly `true`. |

## Developer runbooks

- Supabase migrations, voting, points, reel submission gates, and source suggestions: [`supabase/README.md`](supabase/README.md)
- n8n workflows, deployment, webhooks, and operational notes: [`workflows/n8n/README.md`](workflows/n8n/README.md)
- SearXNG service notes for prompt sourcing: [`infra/searxng/README.md`](infra/searxng/README.md)

## Forum Reels operational model

1. n8n Forum Reels v5 (`forum-trending-prompts.workflow.ts`) reads RSS, SearXNG, and long-running Stortinget issues, then always writes `forum_prompts.status = 'draft'`.
2. Forum admins review and publish drafts in `/dashboard/admin/forum-prompts`.
3. Public users see `/dashboard/forum/spesielle-saker` only when `FORUM_REELS_PUBLIC=true`; otherwise forum admins can preview and everyone else sees a coming-soon state.
4. Users with enough points can submit prompts through `/dashboard/forum/foresla-reel`. Trusted users submit drafts for admin review; curator users can publish directly only when all sources are approved trusted domains.

Keep user-facing states honest: prefer empty or coming-soon messaging over mock prompt data.
