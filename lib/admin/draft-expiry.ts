export const DRAFT_SOFT_EXPIRY_MS = 72 * 60 * 60 * 1000;

export const DRAFT_RESTORE_SUCCESS_MESSAGE =
  'Utkastet er gjenopprettet og ligger nå i Til vurdering.';

export type DraftExpiryLabel = 'Utløper snart' | `Utløper om ${number} t`;

export type DraftSoftExpiryClock = {
  createdAt: string | null | undefined;
  restoredAt?: string | null | undefined;
};

const HOUR_MS = 60 * 60 * 1000;

/** Effective start of the 72h soft-expiry window (matches DB `coalesce(restored_at, created_at)`). */
export function draftSoftExpiryStartMs(clock: DraftSoftExpiryClock): number {
  const restored = clock.restoredAt?.trim();
  if (restored) {
    const restoredMs = Date.parse(restored);
    if (Number.isFinite(restoredMs)) return restoredMs;
  }
  const created = clock.createdAt?.trim();
  if (created) {
    const createdMs = Date.parse(created);
    if (Number.isFinite(createdMs)) return createdMs;
  }
  return Date.now();
}

export function draftExpiryDeadlineMs(
  clock: DraftSoftExpiryClock,
  maxAgeMs = DRAFT_SOFT_EXPIRY_MS,
): number {
  return draftSoftExpiryStartMs(clock) + maxAgeMs;
}

/** Whole hours until soft expiry (rounded up); 0 when under one hour remains. */
export function draftExpiryHoursLeft(
  clock: DraftSoftExpiryClock,
  nowMs = Date.now(),
  maxAgeMs = DRAFT_SOFT_EXPIRY_MS,
): number {
  const msLeft = draftExpiryDeadlineMs(clock, maxAgeMs) - nowMs;
  if (msLeft <= 0) return 0;
  if (msLeft < HOUR_MS) return 0;
  return Math.ceil(msLeft / HOUR_MS);
}

export function formatDraftExpiryLabel(
  clock: DraftSoftExpiryClock,
  nowMs = Date.now(),
  maxAgeMs = DRAFT_SOFT_EXPIRY_MS,
): DraftExpiryLabel {
  const msLeft = draftExpiryDeadlineMs(clock, maxAgeMs) - nowMs;
  if (msLeft < HOUR_MS) return 'Utløper snart';
  const hoursLeft = Math.ceil(msLeft / HOUR_MS);
  return `Utløper om ${hoursLeft} t`;
}

export function isDraftPastSoftExpiry(
  clock: DraftSoftExpiryClock,
  nowMs = Date.now(),
  maxAgeMs = DRAFT_SOFT_EXPIRY_MS,
): boolean {
  return draftExpiryDeadlineMs(clock, maxAgeMs) <= nowMs;
}
