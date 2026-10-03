import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';
import { isStemmePlusActive, type UserSubscriptionRow } from '@/lib/stemme-plus/tier';

export type UserSubscriptionSnapshot = UserSubscriptionRow & {
  userId: string;
};

export type SubscriptionClient = Pick<SupabaseClient, 'from'>;

const SUBSCRIPTION_COLUMNS = 'subscription_tier, subscription_status, subscription_period_end';

function emptySubscription(userId: string): UserSubscriptionSnapshot {
  return {
    userId,
    subscription_tier: 'free',
    subscription_status: null,
    subscription_period_end: null,
  };
}

export async function readUserSubscription(
  client: SubscriptionClient,
  userId: string,
): Promise<UserSubscriptionSnapshot> {
  const { data, error } = await client
    .from('users')
    .select(SUBSCRIPTION_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return emptySubscription(userId);
  }

  return {
    userId,
    subscription_tier: data.subscription_tier,
    subscription_status: data.subscription_status,
    subscription_period_end: data.subscription_period_end,
  };
}

/** Own Stemme+ row via the logged-in request session. No service role. */
export async function getOwnSubscription(userId: string): Promise<UserSubscriptionSnapshot> {
  const session = await getServerSupabase();
  return readUserSubscription(session, userId);
}

export async function ownUserHasStemmePlus(userId: string): Promise<boolean> {
  const row = await getOwnSubscription(userId);
  return isStemmePlusActive(row);
}

/**
 * Cross-user / cron lookup. Overlay chat must use getOwnSubscription instead —
 * a mismatched Cloud Agent service role fail-closes production chat.
 */
export async function getUserSubscription(userId: string): Promise<UserSubscriptionSnapshot> {
  return readUserSubscription(getServiceSupabase(), userId);
}

export async function userHasStemmePlus(userId: string): Promise<boolean> {
  const row = await getUserSubscription(userId);
  return isStemmePlusActive(row);
}
