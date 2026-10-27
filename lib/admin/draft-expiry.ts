export const DRAFT_SOFT_EXPIRY_MS = 72 * 60 * 60 * 1000;

export type DraftExpiryLabel = 'Utløper snart' | `Utløper om ${number} t`;

export function draftExpiryDeadlineMs(createdAtIso: string, maxAgeMs = DRAFT_SOFT_EXPIRY_MS): number {
  const created = Date.parse(createdAtIso);
  if (!Number.isFinite(created)) return Date.now() + maxAgeMs;
  return created + maxAgeMs;
}

const HOUR_MS = 60 * 60 * 1000;

/** Whole hours until soft expiry (rounded up); 0 when under one hour remains. */
export function draftExpiryHoursLeft(
  createdAtIso: string,
  nowMs = Date.now(),
  maxAgeMs = DRAFT_SOFT_EXPIRY_MS,
): number {
  const msLeft = draftExpiryDeadlineMs(createdAtIso, maxAgeMs) - nowMs;
  if (msLeft <= 0) return 0;
  if (msLeft < HOUR_MS) return 0;
  return Math.ceil(msLeft / HOUR_MS);
}

export function formatDraftExpiryLabel(
  createdAtIso: string,
  nowMs = Date.now(),
  maxAgeMs = DRAFT_SOFT_EXPIRY_MS,
): DraftExpiryLabel {
  const msLeft = draftExpiryDeadlineMs(createdAtIso, maxAgeMs) - nowMs;
  if (msLeft < HOUR_MS) return 'Utløper snart';
  const hoursLeft = Math.ceil(msLeft / HOUR_MS);
  return `Utløper om ${hoursLeft} t`;
}

export function isDraftPastSoftExpiry(
  createdAtIso: string,
  nowMs = Date.now(),
  maxAgeMs = DRAFT_SOFT_EXPIRY_MS,
): boolean {
  return draftExpiryDeadlineMs(createdAtIso, maxAgeMs) <= nowMs;
}
