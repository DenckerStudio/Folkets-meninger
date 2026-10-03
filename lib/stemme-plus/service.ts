import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';
import { getServerSupabase } from '@/lib/supabase-server';
import { isStemmePlusActive, type UserSubscriptionRow } from '@/lib/stemme-plus/tier';

export type UserSubscriptionSnapshot = UserSubscriptionRow & {
  userId: string;
};

export type SubscriptionClient = Pick<SupabaseClient, 'from'>;

const TIER_COLUMNS = 'subscription_tier, subscription_status, subscription_period_end';
/** Own-row read. Do not GRANT stripe_customer_id globally — users_select_public_display is USING (true). */
const OWN_SUBSCRIPTION_COLUMNS = `${TIER_COLUMNS}, stripe_customer_id`;

function emptySubscription(userId: string): UserSubscriptionSnapshot {
  return {
    userId,
    subscription_tier: 'free',
    subscription_status: null,
    subscription_period_end: null,
    stripe_customer_id: null,
  };
}

function toSnapshot(userId: string, data: UserSubscriptionRow): UserSubscriptionSnapshot {
  return {
    userId,
    subscription_tier: data.subscription_tier,
    subscription_status: data.subscription_status,
    subscription_period_end: data.subscription_period_end,
    stripe_customer_id: data.stripe_customer_id ?? null,
  };
}

async function selectOwnUserRow(
  client: SubscriptionClient,
  userId: string,
  columns: string,
) {
  return client.from('users').select(columns).eq('id', userId).maybeSingle();
}

export async function readUserSubscription(
  client: SubscriptionClient,
  userId: string,
): Promise<UserSubscriptionSnapshot> {
  const own = await selectOwnUserRow(client, userId, OWN_SUBSCRIPTION_COLUMNS);
  if (!own.error && own.data) {
    return toSnapshot(userId, own.data);
  }

  const tier = await selectOwnUserRow(client, userId, TIER_COLUMNS);
  if (tier.error || !tier.data) {
    return emptySubscription(userId);
  }

  return toSnapshot(userId, tier.data);
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
