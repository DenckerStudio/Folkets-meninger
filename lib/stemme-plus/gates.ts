import type { NotificationFrequency } from '@/lib/notifications/channels';
import { isStemmePlusActive, type UserSubscriptionRow } from '@/lib/stemme-plus/tier';

/** Free users get a short weekly-style teaser in digest emails. */
export const FREE_DIGEST_MAX_ITEMS = 5;

/** Stemme+ digest includes full bodies and more items. */
export const PLUS_DIGEST_MAX_ITEMS = 50;

export function hasStemmePlusBadge(row: UserSubscriptionRow | null | undefined): boolean {
  return isStemmePlusActive(row);
}

export function canUseRealtimeAlerts(row: UserSubscriptionRow | null | undefined): boolean {
  return isStemmePlusActive(row);
}

export function canUseDailyDigest(row: UserSubscriptionRow | null | undefined): boolean {
  return isStemmePlusActive(row);
}

export function digestItemLimit(row: UserSubscriptionRow | null | undefined): number {
  return isStemmePlusActive(row) ? PLUS_DIGEST_MAX_ITEMS : FREE_DIGEST_MAX_ITEMS;
}

export function digestIncludesBody(row: UserSubscriptionRow | null | undefined): boolean {
  return isStemmePlusActive(row);
}

export function digestIncludesChannelGroups(row: UserSubscriptionRow | null | undefined): boolean {
  return isStemmePlusActive(row);
}

export function clampNotificationFrequencyForTier(
  frequency: NotificationFrequency,
  row: UserSubscriptionRow | null | undefined,
): NotificationFrequency {
  if (frequency === 'realtime' && !canUseRealtimeAlerts(row)) {
    return 'daily';
  }
  return frequency;
}

export function normalizeFrequenciesForTier(
  frequencies: Record<string, NotificationFrequency>,
  row: UserSubscriptionRow | null | undefined,
): Record<string, NotificationFrequency> {
  const next: Record<string, NotificationFrequency> = { ...frequencies };
  for (const [channel, frequency] of Object.entries(next)) {
    next[channel] = clampNotificationFrequencyForTier(frequency, row);
  }
  return next;
}
