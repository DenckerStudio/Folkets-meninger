import { createNotification } from '@/lib/notifications';
import { getServiceSupabase } from '@/lib/supabase';
import { routes } from '@/lib/routes';

const REPLY_CHANNEL = 'labels';
/** Keep the fan-out bounded so a reply request stays responsive. */
const MAX_RECIPIENTS = 25;

/**
 * B8: when someone replies to an opinion about a sak you have taken a stance
 * on, notify you. Recipients are users with an `issue_stances` row for the
 * issue (service role reads past RLS). Best-effort — callers wrap this in a
 * try/catch so a notification failure never fails the reply itself.
 */
export async function notifyIssueStanceHoldersOnReply(options: {
  replyAuthorUserId: string;
  opinionId: string;
  opinionTitle: string;
  issueId: string | null;
  issueTitle?: string | null;
  origin?: string | null;
}): Promise<void> {
  const issueId = options.issueId?.trim();
  if (!issueId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const service = getServiceSupabase();
  const { data, error } = await service
    .from('issue_stances')
    .select('user_id')
    .eq('stortinget_issue_id', issueId)
    .neq('user_id', options.replyAuthorUserId)
    .limit(MAX_RECIPIENTS);

  if (error) {
    console.error('notifyIssueStanceHoldersOnReply lookup error:', error.message);
    return;
  }

  const recipients = [
    ...new Set((data ?? []).map((row) => String(row.user_id)).filter(Boolean)),
  ];
  if (recipients.length === 0) return;

  const body = options.issueTitle
    ? `Noen svarte på «${options.opinionTitle}» om saken «${options.issueTitle}».`
    : `Noen svarte på «${options.opinionTitle}».`;

  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type: 'opinion_reply_on_stance_issue',
        channel: REPLY_CHANNEL,
        title: 'Nytt svar på en mening om saken din',
        body,
        url: routes.opinion(options.opinionId),
        origin: options.origin,
        data: { sakId: issueId, opinionId: options.opinionId },
      }),
    ),
  );
}
