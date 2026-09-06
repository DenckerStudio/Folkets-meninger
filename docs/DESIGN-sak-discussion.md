# Design: Sak-scoped discussion (replacement for removed forum)

**Status:** Investigation / recommendation (2026-09-06)  
**Author:** Cloud agent design pass  
**Audience:** Mathias — product + engineering review before implementation

## Executive summary

Folkets Stemme should **not** revive the old site-wide forum. The right product is a **sak- and høring-scoped discussion layer** embedded in existing pages (Utforsk → sak detail, Høringer detail), with **no top-level “Forum” nav** and **no AI prompt/reel pipeline tied to user posts**.

**Recommendation:** **Option B** — greenfield schema (`issue_discussions` + `issue_discussion_posts`) with **Option C’s information architecture** (no separate forum section; a “Diskusjon” tab on sak pages and threaded comments on høring pages). Do **not** attempt to restore dropped `forum_*` tables or archived n8n workflows.

---

## 1. What the old forum was

### 1.1 Product surface

| Area | What existed |
|------|----------------|
| **Routes** | `/dashboard/forum/**`, `/dashboard/admin/forum-*`, `/api/forum/**`, `/api/admin/forum-*` |
| **Nav** | “Forum” in primary nav; post-login default was forum (later changed to Utforsk during removal) |
| **Sak coupling** | Threads could attach `stortinget_issue_id`; sak pages showed forum CTAs and “related discussions” |
| **Polls / initiativ** | `polls.forum_thread_id`, `citizen_initiatives.forum_thread_id`, `get_poll_top_arguments` pulled stance-tagged replies from forum |
| **Reels** | `forum_prompts` — AI/news-driven JA/NEI “reels” with discuss-click thresholds spawning `forum_threads` |
| **Points** | `award_points_for_forum_*` triggers on threads, replies, likes, prompt votes, discuss clicks |
| **Notifications** | `forum` and `mentions` channels |
| **Admin** | Prompt moderation, research clusters, trusted sources, reports queue |

Redirects today: `/forum` and `/dashboard/forum/**` → `/dashboard/utforsk` (`next.config.ts`).

### 1.2 Database (historical — all dropped)

Created across migrations `20260530120000` through `20260621120000`, removed in **`20260810120000_remove_forum_and_activity_visibility.sql`**.

| Table group | Tables | Purpose |
|-------------|--------|---------|
| **UGC core** | `forum_threads`, `forum_replies`, `forum_likes`, `forum_dislikes` | Reddit-like threads; optional `stortinget_issue_id`, nested `parent_reply_id`, `context_items` jsonb |
| **Reels / prompts** | `forum_prompts`, `forum_prompt_votes`, `forum_prompt_discuss_clicks`, `forum_prompt_moderation_feedback` | AI + RSS-generated discussion prompts; user reel submissions |
| **Research pipeline** | `forum_research_clusters`, `forum_research_articles`, `forum_trusted_sources` | Scout → journalist → editor n8n chain; Regjeringen RSS ingest |
| **Moderation** | `forum_reports` | User reports on threads/replies |

Key RPCs (all dropped except wrapper): `create_forum_thread`, `create_forum_reply`, `toggle_forum_like` / `dislike`, `submit_forum_prompt`, `get_poll_top_arguments`, `forum_moderation_check`, `award_points_for_forum_*`.

**Still present (intentionally kept):**

- `user_has_public_identity` (+ `user_has_forum_identity` wrapper)
- `hearing_comments` + `create_hearing_comment`
- `users.first_name` / `last_name`, `activity_visibility`

### 1.3 n8n (archived under `workflows/n8n/archive/forum/`)

| Workflow | Role |
|----------|------|
| `forum-regjeringen-rss-ingest` | RSS → `forum_research_clusters` |
| `forum-prompt-generator` | Cluster → Ollama → `forum_prompts` draft |
| `forum-sak-prompt-generator` (v13) | Sak RAG → `forum_prompts` with `stortinget_issue_id` |
| `forum-research-discovery`, `forum-story-research`, `forum-story-editor` | v10/v11 scout pipeline (deprecated) |
| `forum-trending-prompts` | Trending reel selection |

**Replacement for AI-generated engagement:** `system-poll-draft.workflow.ts` writes to `polls` (`track=system`), published under **Avstemninger → Reels** — decoupled from user discussion.

### 1.4 Points / gamification

Forum used `user_points_ledger` + level UI driven by forum activity. Removal locked decision: **no forum points**; replace with:

- Opt-in `activity_visibility` (`private` | `summary` | `full`)
- **Knowledge points** for quiz, document reads, motforslag, hearing comments (`20260822120000_knowledge_and_counter_proposals.sql`) — not for general chatter

### 1.5 Why it was removed

Documented in `infra/coolify/README.md` (Alternativ C + F0–F5) and `.cursor/agents/forum-removal-egress.md`:

1. **Supabase egress** — n8n full-table scans on `forum_prompts` / clusters; app reads on threads/replies/likes; `detail_json` in prompt pipelines.
2. **Product complexity** — general forum competed with sak voting, polls, høringer, motforslag; reels/prompts were a separate editorial product.
3. **Tight coupling** — polls/initiativ depended on `forum_thread_id` and top-arguments RPC.
4. **Operational load** — multi-workflow n8n mesh (scout, RSS, synthesis, sak-RAG) with admin moderation surfaces.
5. **Explicit product lock** — no forum data export; DROP after app removal (PR #66, `ac6a77b`).

---

## 2. Forum schema today

**All `forum_*` tables and forum RPCs are dropped** in `20260810120000_remove_forum_and_activity_visibility.sql` (lines 101–137). Historical definitions remain only in earlier migrations for audit/history.

Grep of live migrations: no `CREATE TABLE forum_*` after the removal migration. App code: no `lib/forum/**` or `app/dashboard/forum/**`; only archive paths and redirect stubs reference “forum”.

**Option A (revive leftover schema) is not viable** — tables are gone, data was not exported, and F0 decisions forbid restoring forum points, reels, top-arguments, and global forum IA.

---

## 3. Existing patterns to build on

| Feature | Scope | Pattern |
|---------|-------|---------|
| **Hearing comments** | `stortinget_hearing_id` | Flat list, `create_hearing_comment` RPC, `user_has_public_identity`, public read RLS |
| **Motforslag** | `stortinget_issue_id` | Structured proposals + endorsements; sak tab “Motforslag”; threshold → n8n package (not UGC chat) |
| **Sak voting** | `stortinget_issue_id` | Anonymous encrypted ballots — **must never correlate with public posts** |
| **System Reels** | `polls.track=system` | Admin-published ja/nei/blank — **not** a discussion surface |
| **Knowledge quiz / badges** | per sak | Engagement without social feed |
| **Politician responses** | per sak | Verified politicians only (`/api/politician/response`) |

Sak page already has tabs: Oversikt, Dokumenter, For deg, **Motforslag** (`components/sak/sak-page-tabs.tsx`). A fifth tab **Diskusjon** fits naturally.

---

## 4. Options compared

### (A) Revive / adapt leftover `forum_*` schema

| Pros | Cons |
|------|------|
| Historical migrations document the shape | Tables **dropped**; no data to migrate back |
| Threads already had `stortinget_issue_id` | Carries reels/prompts/research naming and baggage |
| | Conflicts with locked F0 decisions (no forum points, no reels coupling) |
| | Would recreate egress-heavy listing patterns if copied blindly |

**Verdict:** Reject.

### (B) Greenfield threads attached to `stortinget_issue_id` (± `stortinget_hearing_id`)

| Pros | Cons |
|------|------|
| Clean naming (`issue_discussion_*`); no prompt/research tables | New migrations + RPCs |
| Can enforce **one discussion space per sak** (or capped threads) | Some duplicate concepts vs old forum |
| Service-role writes + RLS read matches hearing/motforslag | |
| Room for nested replies, sorts, reactions in phases | |

**Verdict:** **Recommended** (schema), with C’s UX.

### (C) Comments-only under sak/høring pages (no forum IA)

| Pros | Cons |
|------|------|
| Simplest UX; no global feed | “Reddit-like” needs threading/sorting eventually |
| Lowest egress if paginated | Flat-only feels limited for political debate |
| Matches `hearing_comments` mental model | |

**Verdict:** **Recommended for MVP IA**; implement on top of B’s tables (single implicit thread per sak = flat comments).

### Combined recommendation: **B + C**

- **Schema:** greenfield, sak-scoped (and optionally hearing-scoped).
- **IA:** embedded tab on sak page + extend høring detail; **no** `/dashboard/forum`, **no** primary nav item.
- **Utforsk:** optional badge “N kommentarer” from denormalized `discussion_post_count` on `stortinget_issues` (updated by trigger) — avoid listing all post bodies on browse.

---

## 5. Proposed architecture

### 5.1 Data model (greenfield)

```text
issue_discussions
  id uuid PK
  stortinget_issue_id text NOT NULL REFERENCES stortinget_issues(id)
  created_at timestamptz
  -- MVP: UNIQUE(stortinget_issue_id) → exactly one “room” per sak

issue_discussion_posts
  id uuid PK
  discussion_id uuid NOT NULL → issue_discussions
  author_user_id uuid NOT NULL → users
  parent_post_id uuid NULL → self (NULL = top-level)
  body text NOT NULL CHECK (1..4000)   -- shorter than old 10k; political comments rarely need more
  is_removed boolean DEFAULT false     -- soft-delete for moderation
  created_at timestamptz
  reply_count int DEFAULT 0          -- denormalized for top-level sort (phase 2)

hearing_discussion_posts   -- phase 1b or MVP if høringer prioritized
  id, stortinget_hearing_id, author_user_id, parent_post_id, body, ...
  -- OR migrate hearing_comments → posts with parent_post_id in phase 2

content_reports            -- generic, not forum_reports
  reporter_user_id, target_type, target_id, category, created_at
```

**RPCs (service_role only, mirror `create_hearing_comment`):**

- `create_issue_discussion_post(p_user_id, p_issue_id, p_body, p_parent_post_id)`
- `report_content(...)` 
- Phase 2: `toggle_post_upvote(...)`

**RLS:**

- `SELECT` public for non-removed posts (same as hearings).
- No client `INSERT`/`UPDATE` — app API routes call service role.

**Egress discipline:**

- List endpoint: `SELECT id, author_user_id, body, created_at, parent_post_id, reply_count` with `LIMIT 50` + cursor on `created_at`.
- Join author display via narrow `users` projection (`first_name`, `last_name` only) — reuse `resolveHearingCommentAuthor` pattern.
- Never select `detail_json` or document chunks for discussion views.
- Optional: materialized `stortinget_issues.discussion_post_count` updated by trigger for Utforsk cards.

### 5.2 API routes

| Route | Auth | Notes |
|-------|------|-------|
| `GET /api/sak/[id]/discussion` | Public read | Paginated posts; `Cache-Control: private, no-store` for writes freshness |
| `POST /api/sak/[id]/discussion` | Login + public identity | Rate limit (existing middleware policies) |
| `POST /api/sak/[id]/discussion/report` | Login | Creates `content_reports` |
| `GET /api/hearings/[id]/discussion` | Login-gated page today | Same pattern for høringer |

Sak pages are **public** (`isPublicDashboardSakPath`); discussion read can be public, write requires login — aligns with voting (login to participate).

### 5.3 UI integration

| Surface | Change |
|---------|--------|
| **Sak detail** | New tab `#diskusjon` in `SakPageTabs`; composer at top, reverse-chronological list |
| **Utforsk / sak cards** | Optional post count chip (denormalized) |
| **Høringer** | Replace or augment flat `hearing_comments` with threaded posts (phase 1b) |
| **Min side** | Include posts in activity feed only when `activity_visibility` ≠ `private` |
| **Avstemninger / Reels** | No coupling — system polls stay admin-generated |
| **Motforslag tab** | Keep separate; motforslag = structured alternative proposals, diskusjon = open debate |

### 5.4 Notifications

- **MVP:** none (or in-app only on reply-to-your-post, phase 2).
- **Phase 2:** new channel `discussions` — **not** reviving `forum`/`mentions` wholesale.
- Reuse `extractMentions` in `lib/notifications.ts` only if @mentions are added; default off.

### 5.5 n8n

- **No n8n for user-generated discussion** in MVP or phase 2.
- Keep existing workflows: sync-issues, AI summary, document embeddings, system poll draft, motforslag package.
- **Do not** reintroduce `N8N_FORUM_*` env vars or prompt-generator pipelines for UGC.

### 5.6 Moderation

| Layer | Approach |
|-------|----------|
| **Client** | Report button → `content_reports` |
| **Server** | Port regex rules from old `forum_moderation_check` into `lib/moderation/content-check.ts` (app layer, not lost DB function) |
| **Admin** | Minimal queue at `/dashboard/admin/discussions` — list reports, soft-remove post (phase 2) |
| **Rate limits** | Per-IP + per-user on POST (extend `lib/rate-limit.ts`) |
| **Identity** | `user_has_public_identity` required; no anonymous posts |

---

## 6. Pitfalls from the old system (avoid)

| Pitfall | Old behavior | Mitigation |
|---------|--------------|------------|
| **Egress** | n8n scanned `forum_prompts`, clusters; app loaded full thread lists | Paginate; denormalized counts; no n8n on UGC tables |
| **Reels confusion** | User posts tied to `forum_prompts` / discuss clicks | System reels stay in `polls`; discussion is separate |
| **Poll coupling** | `forum_thread_id`, top arguments from replies | Never link polls to discussion tables |
| **Points farming** | Points for likes, discuss clicks, prompt votes | No points for posts/likes; optional knowledge award only for “constructive” hearing-style quality (defer) |
| **Global feed** | `/dashboard/forum` aggregated all topics | Sak/høring scoped only; no cross-topic front page |
| **Mentions spam** | `mentions` notification channel | Defer @mentions; opt-in channel if added |
| **AI moderation cost** | Research/scout/editor chains for prompts | Human reports + lightweight regex first |
| **Auth identity** | `user_has_forum_identity` naming | Already renamed to `user_has_public_identity` |
| **Vote leakage** | Activity feed could imply stance | Activity feed shows “commented on sak X”, never ballot choice |
| **SEO** | `/forum` bookmarks | Keep 301 to utforsk; new URLs under `/dashboard/sak/[id]#diskusjon` |

---

## 7. MVP vs phase 2

### MVP (ship first)

- [ ] `issue_discussions` + `issue_discussion_posts` (single room per sak, **flat** posts only)
- [ ] `create_issue_discussion_post` RPC + `POST/GET` API
- [ ] Sak tab **Diskusjon** + composer (login + complete profile)
- [ ] Public read on sak page
- [ ] Basic `content_reports` + regex content check in API
- [ ] Rate limiting on POST
- [ ] Empty state: “Ingen kommentarer ennå — vær den første”
- [ ] `npm run lint` + `npm run build`; smoke test on one sak

**Explicitly out of MVP:** nested replies, upvotes, karma, global feed, n8n, notifications, Utforsk counts, admin UI, hearing threading.

### Phase 2

- [ ] Nested replies (max depth 2)
- [ ] Sort: Nyeste / Mest støttet (upvotes)
- [ ] `toggle_post_upvote` + unique (user, post)
- [ ] Denormalized `discussion_post_count` on sak list / Utforsk cards
- [ ] In-app notifications on reply (channel `discussions`)
- [ ] Admin moderation queue (soft-delete, ban repeat reporters)
- [ ] Hearing threads (extend `hearing_comments` or parallel `hearing_discussion_posts`)
- [ ] Link from AI summary: “Diskuter denne saken” anchor to `#diskusjon`
- [ ] Optional: highlight posts from users who completed knowledge quiz on same sak (badge only, no points)

### Phase 3 (only if metrics justify)

- Cross-sak “aktive diskusjoner” module on Utforsk (cached top-N by recent post activity)
- @mentions with strict rate limits
- Politician verified badge on posts (reuse politician-status check)
- Export/reporting for moderation compliance

---

## 8. Open questions for Mathias

1. **Høringer parity:** Should MVP include høring discussions, or sak-only first? (`hearing_comments` already covers flat høring feedback.)
2. **Public read vs login-to-read:** Sak pages are public; is discussion readable without login (recommended: yes, write requires login)?
3. **Motforslag vs diskusjon:** Confirm motforslag stays structured/separate from free-form debate.
4. **Moderation staffing:** Is regex + user reports enough for launch, or required admin queue in MVP?
5. **Naming:** “Diskusjon”, “Debatt”, or “Kommentarer” in UI? (Avoid “Forum”.)

---

## 9. Implementation sequencing (when approved)

1. Migration: tables + RPC + RLS + revoke client writes  
2. `lib/discussion/` service layer (mirror `lib/counter-proposals/`)  
3. API routes + rate limits + moderation helper  
4. `DiscussionSection` client component + sak tab  
5. Activity visibility integration on Min side (phase 2)  
6. Docs: update `AGENTS.md` runbook subsection (not replacing this file)

**Branch naming:** `cursor/sak-discussion-mvp-<id>`  
**Do not:** touch `workflows/n8n/archive/forum/`, re-enable forum env vars, or add primary nav link.

---

## References

| Doc / path | Content |
|------------|---------|
| `infra/coolify/README.md` | Alternativ C + forum removal F0–F5 |
| `.cursor/agents/forum-removal-egress.md` | Locked product decisions |
| `supabase/migrations/20260810120000_remove_forum_and_activity_visibility.sql` | DROP forum tables/RPCs |
| `supabase/migrations/20260530120000_forum_enhancements.sql` | Historical forum schema |
| `workflows/n8n/archive/forum/` | Archived reels/prompt pipelines |
| `workflows/n8n/system-poll-draft.workflow.ts` | Current system Reels (polls, not forum) |
| `app/dashboard/horinger/[id]/` | Hearing comments reference UI |
| `components/sak/counter-proposals.tsx` | Sak-scoped UGC reference UI |
