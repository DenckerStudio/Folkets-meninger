import { createNotification } from '@/lib/notifications';
import { routes } from '@/lib/routes';

const SAK_CHANNEL = 'labels';

/**
 * Notifications for hearing innspills promoted from Folkets meninger. Replaces
 * the retired `counter_proposals` notifications; links point at the opinion
 * (the unit that now carries the innspill), not the sak page.
 */
async function notifyInnspillAuthor(options: {
  userId: string;
  type: string;
  title: string;
  body: string;
  opinionId: string;
  sakId: string | null;
  origin?: string | null;
}) {
  await createNotification({
    userId: options.userId,
    type: options.type,
    channel: SAK_CHANNEL,
    title: options.title,
    body: options.body,
    url: routes.opinion(options.opinionId),
    origin: options.origin,
    data: { sakId: options.sakId, opinionId: options.opinionId },
  });
}

export async function notifyOpinionInnspillEndorsed(options: {
  authorUserId: string;
  endorserUserId: string;
  opinionId: string;
  sakId: string | null;
  opinionTitle: string;
  supportCount: number;
  origin?: string | null;
}) {
  if (options.authorUserId === options.endorserUserId) return;

  await notifyInnspillAuthor({
    userId: options.authorUserId,
    type: 'opinion_innspill_endorsed',
    title: 'Noen støttet innspillet ditt',
    body: `«${options.opinionTitle}» har nå ${options.supportCount} støtter.`,
    opinionId: options.opinionId,
    sakId: options.sakId,
    origin: options.origin,
  });
}

export async function notifyOpinionInnspillThresholdMet(options: {
  authorUserId: string;
  opinionId: string;
  sakId: string | null;
  opinionTitle: string;
  supportCount: number;
  supportThreshold: number;
  origin?: string | null;
}) {
  await notifyInnspillAuthor({
    userId: options.authorUserId,
    type: 'opinion_innspill_threshold_met',
    title: 'Innspillet nådde støtteterskelen',
    body: `«${options.opinionTitle}» har ${options.supportCount} av ${options.supportThreshold} støtter og pakkes som innspill.`,
    opinionId: options.opinionId,
    sakId: options.sakId,
    origin: options.origin,
  });
}

export async function notifyOpinionInnspillPackaged(options: {
  authorUserId: string;
  opinionId: string;
  sakId: string | null;
  opinionTitle: string;
  origin?: string | null;
}) {
  await notifyInnspillAuthor({
    userId: options.authorUserId,
    type: 'opinion_innspill_packaged',
    title: 'Innspillet er pakket',
    body: `«${options.opinionTitle}» er sendt videre som strukturert innspill.`,
    opinionId: options.opinionId,
    sakId: options.sakId,
    origin: options.origin,
  });
}
