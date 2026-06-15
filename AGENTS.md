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
- Forum Reels: n8n workflow `MloIdsnX7FozM4dv`; `forum_trusted_sources` (unknown domain → `draft`); votes Ja/Nei/Ikke interessert + separate discuss CTA; agent `.cursor/agents/reels-prompts.md`.
- The repo expects validation via `npm run lint` and `npm run build`; no broad automated test suite assumed in workflows.
- First-time env setup: copy `.env.example` to `.env.local` before `npm run dev` or `npm run build`.
