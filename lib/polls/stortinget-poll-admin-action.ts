'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/gate';
import { ensureStortingetPoll } from '@/lib/polls/service';
import {
  listPollsForStortingetIssueAdmin,
  readStortingetIssueTextSnapshot,
  restoreStortingetIssueTextSnapshot,
} from '@/lib/polls/stortinget-poll-admin-data';
import { setPollClosesAt } from '@/lib/polls/stortinget-poll-closes-at';
import { runPublishStortingetPollAdminAction } from '@/lib/polls/stortinget-poll-admin';
import { routes } from '@/lib/routes';

export type PublishStortingetPollActionResult =
  | { ok: true; pollId: string }
  | { ok: false; error: string };

export async function publishStortingetPollAction(
  raw: Record<string, unknown>,
): Promise<PublishStortingetPollActionResult> {
  const auth = await requireAdmin();
  const result = await runPublishStortingetPollAdminAction(raw, {
    isAdmin: auth.ok,
    deps: {
      listIssuePolls: listPollsForStortingetIssueAdmin,
      readIssueSnapshot: readStortingetIssueTextSnapshot,
      restoreIssueSnapshot: restoreStortingetIssueTextSnapshot,
      ensureStortingetPoll,
      setPollClosesAt,
    },
  });

  if (!result.ok) {
    return result;
  }

  revalidatePath(routes.avstemninger);
  revalidatePath(routes.poll(result.pollId));
  const issueId =
    typeof raw.issueId === 'string' && raw.issueId.trim() ? raw.issueId.trim() : null;
  if (issueId) {
    revalidatePath(routes.sak(issueId));
  }

  return result;
}
