# Follow-up: Aksjoner-admin + AI-tilbakemelding (PR #170)

PR **#170** (`cursor/aksjoner-fangst-306f`) adds `/dashboard/admin/aksjoner`. This branch (`cursor/ai-laering-306f`) adds the shared component `components/admin/admin-poll-draft-review.tsx` and `admin_poll_draft_action` RPC.

After #170 merges, wire the same component into `app/dashboard/admin/aksjoner/admin-aksjoner-client.tsx` for action poll drafts (replace direct publish/archive calls with `/api/admin/polls` PATCH or a thin wrapper that calls `admin_poll_draft_action`).

Until then, Reels-admin and sak-sammendrag regenerering already use the new feedback path.
