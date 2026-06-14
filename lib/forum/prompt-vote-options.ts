/** Vote options shown on forum reels (Ja / Nei / Ikke interessert). */
export const REEL_VOTE_OPTION_IDS = ['ja', 'nei', 'ikke_interessert'] as const;

/** Legacy id kept in DB for existing vote tallies. */
export const LEGACY_REEL_VOTE_OPTION_ID = 'vet_ikke';

const HIDDEN_VOTE_IDS = new Set(['avstemmes']);

export function isReelVoteOptionId(id: string): boolean {
  return (
    (REEL_VOTE_OPTION_IDS as readonly string[]).includes(id) ||
    id === LEGACY_REEL_VOTE_OPTION_ID
  );
}

export function reelVoteOptionLabel(id: string, label: string): string {
  if (id === LEGACY_REEL_VOTE_OPTION_ID || id === 'ikke_interessert') {
    return 'Ikke interessert';
  }
  return label;
}

export function filterReelVoteOptions<T extends { id: string; label: string }>(
  options: T[],
): T[] {
  return options
    .filter((o) => isReelVoteOptionId(o.id) && !HIDDEN_VOTE_IDS.has(o.id))
    .map((o) => ({ ...o, label: reelVoteOptionLabel(o.id, o.label) }));
}

export const DEFAULT_REEL_VOTE_OPTIONS = [
  { id: 'ja', label: 'Ja' },
  { id: 'nei', label: 'Nei' },
  { id: 'ikke_interessert', label: 'Ikke interessert' },
] as const;
