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
- Forum Reels UI: `forum-prompt-carousel.tsx` shows sources as compact outlet chips (article links); Ja/Nei/Ikke interessert votes + separate discuss CTA; dashboard has no global `MobileNav` bottom bar (`navigation.tsx`); forum uses top `ForumMobileNav`.
- Forum Reels n8n v8: én pipeline `mjiQBSdxVv0sAuMu` (`forum-research-discovery.workflow.ts` + `forum-prompt-ingest.shared.ts`, `forum-prompt-synthesis.shared.ts`, `forum-article-enrich.shared.ts`); arkiver `MloIdsnX7FozM4dv`; doc `workflows/n8n/FORUM-PROMPTS-v8.md`; v6 moderering uendret (`FORUM-PROMPTS-v6.md`).
- The repo expects validation via `npm run lint` and `npm run build`; no broad automated test suite assumed in workflows.
