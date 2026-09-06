import { createNotification } from '@/lib/notifications';
import { routes } from '@/lib/routes';
import { getServiceSupabase } from '@/lib/supabase';

const SAK_CHANNEL = 'labels';

async function notifyUser(options: {
  userId: string;
  type: string;
  title: string;
  body: string;
  sakId: string;
  origin?: string | null;
}) {
  const url = routes.sak(options.sakId);
  await createNotification({
    userId: options.userId,
    type: options.type,
    channel: SAK_CHANNEL,
    title: options.title,
    body: options.body,
    url,
    origin: options.origin,
    data: { sakId: options.sakId },
  });
}

export async function notifyCounterProposalThresholdMet(options: {
  authorUserId: string;
  sakId: string;
  proposalTitle: string;
  supportCount: number;
  supportThreshold: number;
  origin?: string | null;
}) {
  await notifyUser({
    userId: options.authorUserId,
    type: 'counter_proposal_threshold_met',
    title: 'Motforslaget nådde støtteterskelen',
    body: `«${options.proposalTitle}» har ${options.supportCount} av ${options.supportThreshold} støtter og pakkes som innspill.`,
    sakId: options.sakId,
    origin: options.origin,
  });
}

export async function notifyCounterProposalPackaged(options: {
  authorUserId: string;
  sakId: string;
  proposalTitle: string;
  origin?: string | null;
}) {
  await notifyUser({
    userId: options.authorUserId,
    type: 'counter_proposal_packaged',
    title: 'Motforslaget er pakket som innspill',
    body: `«${options.proposalTitle}» er sendt videre som strukturert innspill.`,
    sakId: options.sakId,
    origin: options.origin,
  });
}

export async function notifyCounterProposalEndorsed(options: {
  authorUserId: string;
  endorserUserId: string;
  sakId: string;
  proposalTitle: string;
  supportCount: number;
  origin?: string | null;
}) {
  if (options.authorUserId === options.endorserUserId) return;

  await notifyUser({
    userId: options.authorUserId,
    type: 'counter_proposal_endorsed',
    title: 'Noen støttet motforslaget ditt',
    body: `«${options.proposalTitle}» har nå ${options.supportCount} støtter.`,
    sakId: options.sakId,
    origin: options.origin,
  });
}

export async function listCounterProposalEndorserUserIds(proposalId: string): Promise<string[]> {
  const service = getServiceSupabase();
  const { data } = await service
    .from('counter_proposal_endorsements')
    .select('user_id')
    .eq('counter_proposal_id', proposalId);
  return (data ?? []).map((row) => row.user_id);
}
