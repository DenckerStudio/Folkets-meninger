## Learned User Preferences

- Prefer minimal, focused fixes that unblock builds/CI.
- When asked to commit/push, stage only intended changes and exclude unrelated artifacts.
- Prefer working on informatively named branches with prefix `cursor/`.
- Avoid user-visible mock/placeholder data; prefer honest empty/“coming soon” states.

## Learned Workspace Facts

- Single Next.js App Router app (Next.js 15).
- Auth and DB are Supabase (Postgres); app uses SSR cookies/middleware refresh patterns.
- Stortinget data comes from `data.stortinget.no` (public API).
- AI summaries and forum prompts are produced externally via n8n + Ollama and stored in Supabase.
- Forum Reels: n8n workflow `MloIdsnX7FozM4dv`; `forum_trusted_sources` (unknown domain → `draft`); votes Ja/Nei/Ikke interessert + separate discuss CTA; agent `.cursor/agents/reels-prompts.md`.
- The repo expects validation via `npm run lint` and `npm run build`; no broad automated test suite assumed in workflows.

## Cursor Cloud specific instructions

- Package manager is npm (only `package-lock.json`). The update script runs `npm ci`, so dependencies are already installed at session start. Scripts live in `package.json`: `dev`, `build`, `lint`, `test:unit`, `test:e2e`.
- **`.env.local` is required to run the dev server, even without real backend credentials.** `middleware.ts` constructs a Supabase client on every request, so missing/empty `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` makes every page 500. It is gitignored, so recreate it from `.env.example` if absent. Placeholder values (`NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co`, dummy anon/service keys) are enough to boot — `auth.getUser()` just resolves to a null user.
- With placeholder (non-real) Supabase: auth, forum, voting, notifications, AI summaries, and `/dashboard/*` pages are unavailable (dashboard paths redirect to `/auth/login`). Only public, Stortinget-backed pages work: the landing page `/` and public issue pages `/dashboard/sak/<id>` (matched by `isPublicDashboardSakPath`). These fetch live data from the public `data.stortinget.no` API, so outbound internet is needed.
- Good no-credentials smoke test / hello-world: load `/` (renders live "Populære saker nå" issues) then open a `/dashboard/sak/<id>` page. Issue detail pages can take 10–30s on first load while they fetch from the Stortinget API.
- For full auth/forum/voting, point the `SUPABASE_*` / `NEXT_PUBLIC_SUPABASE_*` vars at a real hosted Supabase project and apply `supabase/migrations/*.sql` (see `supabase/README.md`; voting also needs a `private.app_settings` `vote_encryption_secret` pepper).
- `npm run test:unit` shells out to `npx tsx ...`; the first run downloads `tsx` (needs network) and then caches it.
