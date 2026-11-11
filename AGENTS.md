# AGENTS.md — Folkets Meninger

Compact rules for coding agents. Full detail: [`docs/agents/reference.md`](docs/agents/reference.md).
Co-located READMEs: [`README.md`](README.md), [`supabase/README.md`](supabase/README.md),
[`workflows/n8n/README.md`](workflows/n8n/README.md), [`infra/coolify/cms.md`](infra/coolify/cms.md),
[`infra/searxng/README.md`](infra/searxng/README.md).

## Project

**Folkets Meninger** (`https://www.folkets-meninger.no`): Next.js 15 App Router (`fm-web`) on
**Coolify** with self-hosted **Supabase** (Postgres + Auth). **n8n** runs scheduled and AI jobs;
**Payload CMS 3** in `cms/` (`fm-cms`) is source of truth for `/blogg`. **Stemme+** paid tier;
Supabase Auth (email/password + Google).

## Folder map

| Path | Role |
|------|------|
| `app/` | App Router pages, `/dashboard`, `/blogg`, API routes under `/api/*` |
| `components/` | UI (saker, polls, profile, chat, blog, dashboard) |
| `lib/` | Stortinget/Supabase clients, services, admin gate, domain logic |
| `hooks/` | Shared React hooks (`use-auth`, `use-mobile`, …) |
| `supabase/migrations/` | Schema, RLS, RPCs — manual apply only |
| `supabase/hotfix/` | One-off prod SQL — manual apply only |
| `scripts/` | Ops checks, backfills, env helpers |
| `workflows/n8n/` | n8n workflow SDK sources; forum legacy under `archive/` |
| `evals/` | RAG eval harness (`npm run eval:rag*`) |
| `e2e/` | Playwright specs (`npm run test:e2e`) |
| `cms/` | Payload CMS 3 app deployed as `fm-cms` |
| `infra/` | Coolify runbooks (`coolify/`), SearXNG (`searxng/`) |
| `docs/` | Security audits, n8n contracts, [`docs/agents/reference.md`](docs/agents/reference.md) |

## Style

- **TypeScript** `strict: true` in `tsconfig.json`; follow patterns in touched files.
- **UI:** shadcn/ui + Tailwind; `cn()` from `@/lib/utils`; semantic tokens in `app/globals.css`
  (`bg-card`, `text-muted-foreground`, `border-border`, `text-brand`) — not hard-coded grays.
- **Copy:** Norwegian **bokmål** for all user-visible strings (keep product names like «Stemme+»).
- **Diffs:** minimal and focused; stage only intended files.
- **Tests:** co-located `*.test.ts` beside the module under test.
- **Touch targets:** `min-h-11` on buttons, inputs, and primary links.

## Commands

CI install: `npm ci --ignore-scripts` (Node **24**, `package-lock.json` only).

| Step | Command |
|------|---------|
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Evals typecheck | `npm run typecheck:evals` |
| Unit tests | `npm run test:unit` (`check:n8n-workflows` + `scripts/run-unit-tests.mjs`) |
| Build | `npm run build` |
| OG route check | `node scripts/verify-opengraph-image-routes.mjs` |

**Before a PR:** run the `lint-and-build` job sequence above. Local env: `npm run env:test` or
copy `.env.example`; DB: `npm run supabase:start`. Optional: `npm run test:e2e`.

## Workflow

- Feature branch → PR to `main`; all five CI jobs green: `lint-and-build`, `test-unit`,
  `unit-tests`, `db-security`, `migration-sql-lint`.
- **Friction** and **Pixel** review on product/UI changes. **Chief of Staff** approves merges to
  `main` on Mathias's behalf.
- **Mathias** personally: Stripe/money live, outgoing posts, irreversible deletes, opening
  services to the internet, secrets.
- Update long-lived branches by **merging `main` in** (not rebase). No force-push to `main` or to
  branches already on the remote.

## Never do this

- Run `supabase db push` or apply migrations yourself — **Coolify Expert** does backup, dry-run,
  then apply; never edit an applied migration (add a new file).
- New migrations: explicit `REVOKE`/`GRANT`, RLS on new tables, table DDL as `postgres`;
  **`n8n_*` functions/RPCs → `service_role` only**.
- Do **not** apply `supabase/migrations/20261018120000_blog_posts.sql`.
- Put secrets, keys, IPs, or production env values in code, commits, PR bodies, or logs.
- Change Coolify deploy, production env, or secrets from the repo.
- Import checked-in n8n workflow JSON into prod without the owner deploy process.
- Force-push or rebase branches that others (or CI) already pulled.
- Add «AI» badges/labels in UI; ship English UI strings; show mock/placeholder data to users.
- Poll choices: only **Ja / Nei / Blank** (no «Vet ikke»); UI order **Nei** (red) → **Blank**
  (white) → **Ja** (blue) — `POLL_BALLOT_BUTTON_ORDER` in `lib/polls/ballot-buttons.ts`.
- Rebuild **Reels** or **system polls** (retired 2026-11-01).
- Treat **Reddit** as a public factual source (interest signal only; admin/research pipeline).
- Expose `research_topics.title` in public APIs/UI — use public mappers in `lib/research-topics/`.
- Propose **Vercel** hosting (production is **Coolify** only).
- Use **folkets-stemme.no** / «Folkets Stemme» in new copy; mention **BankID** / **MinID** in
  user-facing text.

## More detail

See [`docs/agents/reference.md`](docs/agents/reference.md) for integrations (Stortinget, n8n,
blog/Payload, Stripe, DB security incident), subsystem notes, and environment variable names.
