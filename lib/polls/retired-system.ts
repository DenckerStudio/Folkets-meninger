import { getPollById } from '@/lib/polls/service';
import { isRetiredSystemSharePoll } from '@/lib/polls/share';
import type { PollRecord } from '@/lib/polls/types';

/** Service-role lookup for open/closed system polls hidden from public RLS. */
export async function getRetiredSystemPollById(pollId: string): Promise<PollRecord | null> {
  const poll = await getPollById(pollId);
  if (!poll || !isRetiredSystemSharePoll(poll)) return null;
  return poll;
}

export type PublicPollPageResolution =
  | { kind: 'ballot'; poll: PollRecord }
  | { kind: 'retired' }
  | { kind: 'missing' };

/** Resolve `/del` and embed: public row first, then retired system fallback. */
export async function resolvePublicPollSharePage(
  pollId: string,
  loadPublic: (id: string) => Promise<PollRecord | null>,
): Promise<PublicPollPageResolution> {
  const publicPoll = await loadPublic(pollId).catch(() => null);
  if (publicPoll) return { kind: 'ballot', poll: publicPoll };
  const retired = await getRetiredSystemPollById(pollId);
  if (retired) return { kind: 'retired' };
  return { kind: 'missing' };
}
