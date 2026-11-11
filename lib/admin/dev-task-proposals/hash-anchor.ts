export const DEV_TASK_PROPOSAL_CARD_ID_PREFIX = 'oppgave-';

/** Duration the hash-target card keeps its highlight ring (client-only). */
export const DEV_TASK_PROPOSAL_HASH_HIGHLIGHT_MS = 2800;

export function devTaskProposalCardDomId(proposalId: string): string {
  return `${DEV_TASK_PROPOSAL_CARD_ID_PREFIX}${proposalId}`;
}

/** Parses `location.hash` / `#oppgave-<uuid>` into a proposal id, or null. */
export function parseDevTaskProposalIdFromHash(hash: string): string | null {
  const raw = hash.trim().replace(/^#/, '');
  if (!raw.startsWith(DEV_TASK_PROPOSAL_CARD_ID_PREFIX)) {
    return null;
  }
  const id = raw.slice(DEV_TASK_PROPOSAL_CARD_ID_PREFIX.length).trim();
  if (!id) {
    return null;
  }
  return id;
}

export function isHttpOrHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
