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
- Forum Reels n8n v6: AI-moderering (Moderate prompts Ollama) erstatter «Moderation + route» Code-node; læring fra `forum_prompt_moderation_feedback`; workflow `MloIdsnX7FozM4dv` in `forum-trending-prompts.workflow.ts`; doc `workflows/n8n/FORUM-PROMPTS-v6.md`; deploy via `scripts/build-n8n-forum-prompts-v6-topology-ops.mjs`.
- The repo expects validation via `npm run lint` and `npm run build`; no broad automated test suite assumed in workflows.
