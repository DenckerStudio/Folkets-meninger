import { getServiceSupabase } from '@/lib/supabase';
import { isStemmePlusActive, type UserSubscriptionRow } from '@/lib/stemme-plus/tier';

export type UserSubscriptionSnapshot = UserSubscriptionRow & {
  userId: string;
};

export async function getUserSubscription(userId: string): Promise<UserSubscriptionSnapshot> {
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('users')
    .select(
      'subscription_tier, subscription_status, subscription_period_end, stripe_customer_id, stripe_subscription_id',
    )
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return {
      userId,
      subscription_tier: 'free',
      subscription_status: null,
      subscription_period_end: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
    };
  }

  return {
    userId,
    subscription_tier: data.subscription_tier,
    subscription_status: data.subscription_status,
    subscription_period_end: data.subscription_period_end,
    stripe_customer_id: data.stripe_customer_id,
    stripe_subscription_id: data.stripe_subscription_id,
  };
}

export async function userHasStemmePlus(userId: string): Promise<boolean> {
  const row = await getUserSubscription(userId);
  return isStemmePlusActive(row);
}

export async function applyStemmePlusFromStripe(input: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  periodEnd: Date | null;
}) {
  const service = getServiceSupabase();
  const isActive = statusGrantsStemmePlus(input.status);

  const { error } = await service
    .from('users')
    .update({
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      subscription_status: input.status,
      subscription_period_end: input.periodEnd?.toISOString() ?? null,
      subscription_tier: isActive ? 'stemme_plus' : 'free',
    })
    .eq('id', input.userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function revokeStemmePlusBySubscriptionId(stripeSubscriptionId: string) {
  const service = getServiceSupabase();
  const { error } = await service
    .from('users')
    .update({
      subscription_tier: 'free',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      subscription_period_end: null,
    })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function findUserIdByStripeCustomerId(stripeCustomerId: string): Promise<string | null> {
  const service = getServiceSupabase();
  const { data } = await service
    .from('users')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  return data?.id ?? null;
}

function statusGrantsStemmePlus(status: string): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}
