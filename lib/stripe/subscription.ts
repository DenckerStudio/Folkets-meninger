import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { getServiceSupabase } from '@/lib/supabase';
import { getStemmePlusAppBaseUrl, getStripeRuntimeConfig } from '@/lib/stripe/config';

export function getStripeClient(): Stripe | null {
  const config = getStripeRuntimeConfig();
  if (!config.secretKey) return null;
  return new Stripe(config.secretKey);
}

export function mapStripeStatusToApp(status: string | null | undefined): string | null {
  if (!status) return null;
  return status;
}

/** Active paid/trial states that unlock Stemme+. */
export function isStripeSubscriptionEntitled(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing';
}

/**
 * Terminal / unpaid states that should revoke Stemme+.
 * Incomplete (awaiting first payment) must NOT force `free` — that race left
 * users on free after checkout.session.completed was recorded but apply failed.
 */
export function shouldRevokeStemmePlusTier(status: string | null | undefined): boolean {
  return (
    status === 'canceled' ||
    status === 'unpaid' ||
    status === 'incomplete_expired'
  );
}

export function resolveSubscriptionPeriodEndUnix(
  subscription: Pick<Stripe.Subscription, 'items'> & {
    current_period_end?: number | null;
  },
): number | null {
  const fromSub =
    typeof subscription.current_period_end === 'number' ? subscription.current_period_end : null;
  if (fromSub && fromSub > 0) return fromSub;
  const item = subscription.items?.data?.[0] as { current_period_end?: number } | undefined;
  const fromItem = item?.current_period_end;
  return typeof fromItem === 'number' && fromItem > 0 ? fromItem : null;
}

export function resolveSubscriptionTierPatch(
  status: string | null | undefined,
): { subscription_tier: 'stemme_plus' | 'free' } | Record<string, never> {
  if (isStripeSubscriptionEntitled(status)) {
    return { subscription_tier: 'stemme_plus' };
  }
  if (shouldRevokeStemmePlusTier(status)) {
    return { subscription_tier: 'free' };
  }
  // incomplete / past_due / paused: keep existing tier; still store Stripe ids + status
  return {};
}

export async function applyStripeSubscriptionToUser(args: {
  userId?: string | null;
  customerId?: string | null;
  subscription: Stripe.Subscription;
}): Promise<void> {
  const service = getServiceSupabase();
  const periodEndUnix = resolveSubscriptionPeriodEndUnix(args.subscription);
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;
  const customerId =
    typeof args.subscription.customer === 'string'
      ? args.subscription.customer
      : args.customerId ?? null;

  const tierPatch = resolveSubscriptionTierPatch(args.subscription.status);
  const patch = {
    stripe_customer_id: customerId,
    stripe_subscription_id: args.subscription.id,
    subscription_status: mapStripeStatusToApp(args.subscription.status),
    subscription_period_end: periodEnd,
    ...tierPatch,
  };

  const userId = args.userId?.trim() || null;

  if (userId) {
    const { data, error } = await service
      .from('users')
      .update(patch)
      .eq('id', userId)
      .select('id');
    if (error) throw error;
    if (!data?.length) {
      throw new Error(`Stripe webhook: no user row for id ${userId}`);
    }
    return;
  }

  if (customerId) {
    const { data, error } = await service
      .from('users')
      .update(patch)
      .eq('stripe_customer_id', customerId)
      .select('id');
    if (error) throw error;
    if (!data?.length) {
      throw new Error(
        `Stripe webhook: no user with stripe_customer_id ${customerId} (missing user_id metadata?)`,
      );
    }
    return;
  }

  throw new Error('Stripe webhook: missing user_id and customer id');
}

export async function clearStripeSubscription(customerId: string): Promise<void> {
  const service = getServiceSupabase();
  const { error } = await service
    .from('users')
    .update({
      subscription_tier: 'free',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
    })
    .eq('stripe_customer_id', customerId);
  if (error) throw error;
}

export async function recordStripeEvent(eventId: string, type: string): Promise<boolean> {
  const service = getServiceSupabase();
  const { error } = await service.from('stripe_webhook_events').insert({
    id: eventId,
    type,
  });
  if (error) {
    if (error.code === '23505') return false;
    throw error;
  }
  return true;
}

export async function createStemmePlusCheckoutSession(args: {
  userId: string;
  email: string | null;
}): Promise<{ url: string } | { error: string; status: number }> {
  const config = getStripeRuntimeConfig();
  if (!config.checkoutConfigured || !config.secretKey || !config.priceId) {
    return {
      status: 503,
      error: 'Stripe-betaling er ikke konfigurert ennå. Admin kan tildele Stemme+ for testing.',
    };
  }

  const baseUrl = getStemmePlusAppBaseUrl();
  const stripe = new Stripe(config.secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: config.priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/min-side?tab=stemme-plus&checkout=success`,
    cancel_url: `${baseUrl}/dashboard/min-side?tab=stemme-plus&checkout=cancel`,
    client_reference_id: args.userId,
    customer_email: args.email || undefined,
    metadata: { user_id: args.userId },
    subscription_data: {
      metadata: { user_id: args.userId },
    },
    allow_promotion_codes: true,
    locale: 'nb',
    // Marketplace Checkout: omit payment_method_types so Stripe picks dynamic methods.
    integration_identifier: `stemmeplus_${randomBytes(4).toString('hex')}`,
  });

  if (!session.url) {
    return { status: 500, error: 'Stripe returnerte ingen betalingsside' };
  }
  return { url: session.url };
}

export async function createBillingPortalSession(args: {
  customerId: string;
}): Promise<{ url: string } | { error: string; status: number }> {
  const config = getStripeRuntimeConfig();
  if (!config.secretKey) {
    return { status: 503, error: 'Stripe-kundeportal er ikke konfigurert' };
  }
  const baseUrl = getStemmePlusAppBaseUrl();
  const stripe = new Stripe(config.secretKey);
  const session = await stripe.billingPortal.sessions.create({
    customer: args.customerId,
    return_url: `${baseUrl}/dashboard/min-side?tab=stemme-plus`,
  });
  return { url: session.url };
}
