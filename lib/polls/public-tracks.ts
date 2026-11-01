import type { PollTrack } from '@/lib/polls/types';

/** Poll tracks shown in Avstemninger and eligible for public vote/share. */
export const PUBLIC_AVSTEMNING_TRACKS = ['stortinget'] as const satisfies readonly PollTrack[];

export function isPublicAvstemningTrack(track: PollTrack): boolean {
  return (PUBLIC_AVSTEMNING_TRACKS as readonly string[]).includes(track);
}
