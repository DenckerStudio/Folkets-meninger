import { getServiceSupabase } from '@/lib/supabase';
import { isStemmePlusActive, type UserSubscriptionRow } from '@/lib/stemme-plus/tier';

export type UserSubscriptionSnapshot = UserSubscriptionRow & {
  userId: string;
};

export async function getUserSubscription(userId: string): Promise<UserSubscriptionSnapshot> {
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('users')
    .select('subscription_tier, subscription_status, subscription_period_end')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return {
      userId,
      subscription_tier: 'free',
      subscription_status: null,
      subscription_period_end: null,
    };
  }

  return {
    userId,
    subscription_tier: data.subscription_tier,
    subscription_status: data.subscription_status,
    subscription_period_end: data.subscription_period_end,
  };
}

export async function userHasStemmePlus(userId: string): Promise<boolean> {
  const row = await getUserSubscription(userId);
  return isStemmePlusActive(row);
}
