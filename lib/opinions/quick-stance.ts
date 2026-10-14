/**
 * Quick stance (one-tap Enig/Uenig) and a written reply share ONE row in
 * `citizen_opinion_replies` (unique per opinion + author). A quick stance is a
 * row with an empty body; a written reply is the same row with a body.
 *
 * These pure helpers decide what a quick-stance toggle may do to that row so a
 * written reply is never wiped by a tap, and un-tapping never errors.
 */

export type ExistingReplyRow = {
  id: string;
  stance: string | null;
  body: string | null;
  is_removed?: boolean | null;
} | null;

export function hasWrittenBody(row: ExistingReplyRow): boolean {
  return Boolean(row && !row.is_removed && (row.body ?? '').trim().length > 0);
}

export type QuickStanceRemovalPlan =
  /** Soft-delete the empty-body quick stance row. */
  | { action: 'remove'; replyId: string }
  /** The row is a written reply: leave it (and its stance) untouched. */
  | { action: 'keep-reply'; replyId: string; stance: string | null }
  /** Nothing to remove; treat as already removed (idempotent, no error). */
  | { action: 'noop' };

export function planQuickStanceRemoval(row: ExistingReplyRow): QuickStanceRemovalPlan {
  if (!row || row.is_removed) return { action: 'noop' };
  if (hasWrittenBody(row)) return { action: 'keep-reply', replyId: row.id, stance: row.stance };
  return { action: 'remove', replyId: row.id };
}

export type QuickStanceSavePlan =
  /** Upsert the empty-body quick stance (no written reply to protect). */
  | { action: 'save' }
  /** A written reply exists: do not overwrite its body with an empty one. */
  | { action: 'keep-reply'; replyId: string; stance: string | null };

export function planQuickStanceSave(row: ExistingReplyRow): QuickStanceSavePlan {
  if (hasWrittenBody(row)) return { action: 'keep-reply', replyId: row!.id, stance: row!.stance };
  return { action: 'save' };
}

/** Response body for un-tapping a quick stance. Always 200 for a signed-in user. */
export type QuickStanceRemovalResponse = {
  success: true;
  removed: boolean;
  keptReply: boolean;
  stance: string | null;
};

export function removalResponse(plan: QuickStanceRemovalPlan): QuickStanceRemovalResponse {
  if (plan.action === 'remove') return { success: true, removed: true, keptReply: false, stance: null };
  if (plan.action === 'keep-reply') {
    return { success: true, removed: false, keptReply: true, stance: plan.stance };
  }
  return { success: true, removed: false, keptReply: false, stance: null };
}
