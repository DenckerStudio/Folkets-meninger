# Supabase migrations

Run migrations against your Supabase project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Or paste `supabase/migrations/*.sql` into the Supabase SQL editor.

## Voting setup

1. Apply `20260528000001_anonymous_voting.sql` (requires `pgcrypto` in the `extensions` schema — standard on Supabase).
2. If voting fails with 500, ambiguous `cast_vote`, or legacy schema errors, run **`20260528000002_vote_schema_repair.sql`**.
3. Set a strong pepper **without** requiring `ALTER DATABASE` permissions:

```sql
INSERT INTO private.app_settings (key, value)
VALUES ('vote_encryption_secret', 'your-long-random-secret')
ON CONFLICT (key) DO UPDATE SET value = excluded.value;
```

4. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in the Next.js app (server-only).

### Architecture

| Table | Purpose |
|-------|---------|
| `citizen_votes` | Anonymous ballots (`issue_id` + `choice` only) |
| `user_vote_receipts` | One row per user per issue; `choice` stored as `pgp_sym_encrypt` |
| `stortinget_issues` | Issue title/summary cache |

Aggregates are exposed via `get_issue_vote_totals` / `get_vote_totals_batch`. Direct reads on `citizen_votes` are denied by RLS.

## User points and Forum Reels gates

Points are persisted in `user_points_balances` and `user_points_ledger` from migration `20260614130000_forum_profiles_points_ai_sources.sql`. `award_user_points` is idempotent by `(user_id, reason, ref_key)` and is executable by `service_role`; public clients should not call it directly.

### Point events

| Event | Delta | Source |
|-------|-------|--------|
| Stortinget vote receipt inserted | `+3` | `trg_award_points_for_vote_receipt` on `user_vote_receipts` |
| Approved forum thread created | `+10` | `trg_award_points_for_forum_thread` |
| Approved forum reply created | `+5` | `trg_award_points_for_forum_reply` |
| Forum like given | `+1` | `trg_award_points_for_forum_like` |
| Forum like received by another author | `+2` | `trg_award_points_for_forum_like` |
| Forum Reel vote | `+2` | `trg_award_points_for_forum_prompt_vote` |
| Forum Reel discuss click | `+1` | `trg_award_points_for_forum_prompt_discuss` |
| Complete public, verified profile | `+15` | `app/api/user/profile` calls `award_user_points` with `profile_complete` |
| User-submitted reel published or approved | `+25` | `submit_forum_prompt` or `trg_award_points_for_approved_user_reel` |

The UI tier thresholds live in `lib/user-points-levels.ts`:

| Tier | Min points | Unlock |
|------|------------|--------|
| `new` | `0` | Basic reading, voting, and forum participation. |
| `active` | `250` | Visible active profile badge. |
| `trusted` | `750` | Can submit Forum Reel drafts for admin approval. |
| `curator` | `2000` | Can publish reels directly when every source URL matches an approved trusted domain. |
| `veteran` | `5000` | Can suggest new trusted news sources for admin review. |

### User-submitted Forum Reels

Migration `20260620140000_forum_reel_user_submission.sql` adds:

- `forum_prompts.submitted_by`
- `forum_prompts.submission_tier` (`trusted` or `curator`)
- RPC `submit_forum_prompt(p_user_id, p_question, p_source_headlines, p_topic_tags, p_sensitivity)`
- source helpers `normalize_url_hostname` and `url_has_trusted_source`

The app route `POST /api/forum/reel-submit` validates the session, checks the current point balance and weekly usage, validates source headlines, then calls `submit_forum_prompt` with the service role key.

Constraints enforced in both app code and SQL:

- Minimum `750` points to submit.
- Trusted tier (`750`-`1999` points): max `2` submissions per rolling 7 days; submissions are always `draft`.
- Curator tier (`2000+` points): max `5` submissions per rolling 7 days; submissions become `active` only when every source URL belongs to an approved `forum_trusted_sources.domain`. Unknown domains still require admin approval.
- Question length: `12` to `280` characters.
- At least one source with title and URL is required.
- Active direct-published reels expire after 7 days.

Admins review drafts at `/dashboard/admin/forum-prompts`. Public reels remain hidden unless `FORUM_REELS_PUBLIC=true`; when false, only forum admins can preview `/dashboard/forum/spesielle-saker`.

### Trusted source suggestions

Migration `20260620160000_veteran_source_suggestions.sql` adds `forum_trusted_sources.suggested_by` and RPC `suggest_trusted_news_source(p_user_id, p_domain, p_outlet_label)`.

`POST /api/forum/suggest-source` requires:

- `5000` points.
- Max `3` suggestions per rolling 30 days.
- Domain without protocol, normalized away from a leading `www.`.
- Outlet label between `2` and `80` characters.
- No existing `forum_trusted_sources.domain` match.

Accepted suggestions are inserted with `status = 'pending'` for admin review.

### Troubleshooting

- `insufficient points for reel submission` or HTTP `403`: inspect `user_points_balances` for the user and verify the relevant triggers/RPC grants are applied.
- `weekly reel submission limit reached` or HTTP `429`: count `forum_prompts` rows for `submitted_by = <user_id>` in the last 7 days.
- Curator submissions unexpectedly become `draft`: check each submitted URL with `normalize_url_hostname`; every hostname must match an approved `forum_trusted_sources.domain` or subdomain.
- Source suggestion `409`: the domain already exists, even if it is pending or rejected.
- Missing points after an action: check `user_points_ledger` for an existing `(user_id, reason, ref_key)` row; duplicate point awards are intentionally ignored.
