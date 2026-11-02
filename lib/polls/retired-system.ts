import { getPollById, getSharePagePollById } from '@/lib/polls/service';
import { isRetiredSystemSharePoll, isShareablePoll } from '@/lib/polls/share';
import type { PollRecord } from '@/lib/polls/types';

/** Open/closed system poll by id (service role, or public row before RLS hides track=system). */
export async function getRetiredSystemPollById(pollId: string): Promise<PollRecord | null> {
  const servicePoll = await getPollById(pollId);
  if (servicePoll && isRetiredSystemSharePoll(servicePoll)) return servicePoll;

  const publicPoll = await getSharePagePollById(pollId).catch(() => null);
  if (publicPoll && isRetiredSystemSharePoll(publicPoll)) return publicPoll;

  return null;
}

export type PublicPollPageResolution =
  | { kind: 'ballot'; poll: PollRecord }
  | { kind: 'retired' }
  | { kind: 'missing' };

/** Resolve `/del` and embed: ballot, retired system notice, or missing. */
export async function resolvePublicPollSharePage(
  pollId: string,
  loadPublic: (id: string) => Promise<PollRecord | null>,
): Promise<PublicPollPageResolution> {
  const publicPoll = await loadPublic(pollId).catch(() => null);
  if (publicPoll && isRetiredSystemSharePoll(publicPoll)) {
    return { kind: 'retired' };
  }
  if (publicPoll && isShareablePoll(publicPoll)) {
    return { kind: 'ballot', poll: publicPoll };
  }
  const retired = await getRetiredSystemPollById(pollId);
  if (retired) return { kind: 'retired' };
  return { kind: 'missing' };
}
