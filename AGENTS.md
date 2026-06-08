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
- Forum Reels public UI is temporarily off (`lib/forum/reels-public.ts` → `FORUM_REELS_PUBLIC_ENABLED = false`); carousel + `/forum/spesielle-saker` hidden until post-launch polish. Admin pipeline stays at `/dashboard/admin/forum-prompts?tab=pipeline`.
- Forum Reels UI (when enabled): `forum-prompt-carousel.tsx` shows sources as compact outlet chips (article links); Ja/Nei/Ikke interessert votes + separate discuss CTA; dashboard has no global `MobileNav` bottom bar (`navigation.tsx`); forum uses top `ForumMobileNav`.
- Forum Reels n8n v12 (live): RSS ingest `6yy1ESY2Zy7cWgtF`, prompt generator `vOP2zPflfT0yBvDQ` – Regjeringen RSS → pending clusters → fetch + én Ollama-agent → transaksjonell lagring (`forum_prompts` draft, cluster `draft`); ingen processing-status; kilder `forum-regjeringen-rss-ingest.workflow.ts` / `forum-prompt-generator.workflow.ts`; admin pipeline `/dashboard/admin/forum-prompts?tab=pipeline`.
- The repo expects validation via `npm run lint` and `npm run build`; no broad automated test suite assumed in workflows.
