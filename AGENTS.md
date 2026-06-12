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
- Supabase credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are provided as Cloud Agent secrets / env vars and point at a real hosted project with all `supabase/migrations/*.sql` applied (voting `vote_encryption_secret` pepper is configured). Browser-side auth from the in-VM Chrome reaches Supabase fine — the full auth/forum/voting flow works end-to-end.
- **`.env.local` is still required to run the dev server**, because it carries the non-secret `STORTINGET_*` / `NEXT_PUBLIC_STORTINGET_*` defaults (and `middleware.ts` builds a Supabase client on every request, so the `NEXT_PUBLIC_SUPABASE_*` values must be resolvable or every page 500s). It is gitignored; recreate from `.env.example` if absent. Next.js reads injected `process.env` with higher precedence than `.env.local`, so the injected secrets win even if `.env.local` holds older values.
- Auth is email/password (`supabase.auth.signUp` / `signInWithPassword`). **Email signups require confirmation**, so a raw signup does NOT create a session. To get a usable test login, create a pre-confirmed user with the admin API and the service role key, then sign in: `POST {SUPABASE_URL}/auth/v1/admin/users` with `{"email":...,"password":...,"email_confirm":true,"user_metadata":{...}}` (the project rejects `@example.com`; use e.g. `@gmail.com`).
- `/dashboard/*` is gated by middleware (redirects to `/auth/login`) except public issue pages `/dashboard/sak/<id>` (see `isPublicDashboardSakPath`). Issue pages fetch live `data.stortinget.no` data and can take 10–30s on first load.
- Hello-world that exercises core functionality: log in, then open an issue (`/dashboard/sak/<id>`) and cast a "For" vote in the "Hva mener du?" section — the vote persists and the `/dashboard/min-side` vote count updates.
- `npm run test:unit` shells out to `npx tsx ...`; the first run downloads `tsx` (needs network) and then caches it.
