import type { UserSubscriptionRow } from '@/lib/stemme-plus/tier';
import { isStemmePlusActive } from '@/lib/stemme-plus/tier';
import {
  SELF_DELETE_LAST_ADMIN_BLOCK_MESSAGE,
  SELF_DELETE_STEMME_PLUS_BLOCK_MESSAGE,
  stemmePlusBlockMessageWithPeriodEnd,
} from '@/lib/account-delete/constants';

export type SelfDeleteBlockReason = 'stemme_plus' | 'last_admin';

export type SelfDeleteEligibility = {
  allowed: boolean;
  reason?: SelfDeleteBlockReason;
  message?: string;
  subscription_period_end?: string | null;
};

export function formatSubscriptionPeriodEndNb(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Oslo',
  });
}

export function evaluateStemmePlusDeleteBlock(
  row: UserSubscriptionRow | null | undefined,
  now = new Date(),
): Pick<SelfDeleteEligibility, 'allowed' | 'reason' | 'message' | 'subscription_period_end'> {
  if (!isStemmePlusActive(row, now)) {
    return { allowed: true };
  }

  const periodEnd = row?.subscription_period_end ?? null;
  const formatted = periodEnd ? formatSubscriptionPeriodEndNb(periodEnd) : null;
  const message = formatted
    ? stemmePlusBlockMessageWithPeriodEnd(formatted)
    : SELF_DELETE_STEMME_PLUS_BLOCK_MESSAGE;

  return {
    allowed: false,
    reason: 'stemme_plus',
    message,
    subscription_period_end: periodEnd,
  };
}

export function evaluateLastAdminDeleteBlock(isOnlyAdmin: boolean): Pick<SelfDeleteEligibility, 'allowed' | 'reason' | 'message'> {
  if (!isOnlyAdmin) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'last_admin',
    message: SELF_DELETE_LAST_ADMIN_BLOCK_MESSAGE,
  };
}

export function mergeDeleteEligibility(
  checks: Array<Pick<SelfDeleteEligibility, 'allowed' | 'reason' | 'message' | 'subscription_period_end'>>,
): SelfDeleteEligibility {
  for (const check of checks) {
    if (!check.allowed) {
      return {
        allowed: false,
        reason: check.reason,
        message: check.message,
        subscription_period_end: check.subscription_period_end,
      };
    }
  }
  return { allowed: true };
}