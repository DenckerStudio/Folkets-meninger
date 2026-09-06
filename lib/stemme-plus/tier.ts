import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  type SubscriptionTier,
} from '@/lib/stemme-plus/constants';

export type UserSubscriptionRow = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  subscription_period_end?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

export function parseSubscriptionTier(value: unknown): SubscriptionTier {
  return value === 'stemme_plus' ? 'stemme_plus' : 'free';
}

export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  if (!status) return true;
  return (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

export function isStemmePlusActive(row: UserSubscriptionRow | null | undefined, now = new Date()): boolean {
  if (!row || parseSubscriptionTier(row.subscription_tier) !== 'stemme_plus') {
    return false;
  }

  if (!isActiveSubscriptionStatus(row.subscription_status ?? null)) {
    return false;
  }

  if (row.subscription_period_end) {
    const end = new Date(row.subscription_period_end);
    if (!Number.isNaN(end.getTime()) && end.getTime() <= now.getTime()) {
      return false;
    }
  }

  return true;
}

export function subscriptionTierLabel(tier: SubscriptionTier): string {
  return tier === 'stemme_plus' ? 'Stemme+' : 'Gratis';
}
