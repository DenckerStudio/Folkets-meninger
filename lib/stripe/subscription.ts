import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { getServiceSupabase } from '@/lib/supabase';
import { getStripeRuntimeConfig } from '@/lib/stripe/config';

export function getStripeClient(): Stripe | null {
  const config = getStripeRuntimeConfig();
  if (!config.secretKey) return null;
  return new Stripe(config.secretKey);
}

export function mapStripeStatusToApp(status: string | null | undefined): string | null {
  if (!status) return null;
  return status;
}

export async function applyStripeSubscriptionToUser(args: {
  userId?: string | null;
  customerId?: string | null;
  subscription: Stripe.Subscription;
}): Promise<void> {
  const service = getServiceSupabase();
  const item = args.subscription.items.data[0] as { current_period_end?: number } | undefined;
  const periodEndUnix = item?.current_period_end;
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;
  const active =
    args.subscription.status === 'active' || args.subscription.status === 'trialing';

  const patch = {
    stripe_customer_id: typeof args.subscription.customer === 'string'
      ? args.subscription.customer
      : args.customerId,
    stripe_subscription_id: args.subscription.id,
    subscription_status: mapStripeStatusToApp(args.subscription.status),
    subscription_period_end: periodEnd,
    subscription_tier: active ? 'stemme_plus' : 'free',
  };

  if (args.userId) {
    const { error } = await service.from('users').update(patch).eq('id', args.userId);
    if (error) throw error;
    return;
  }

  if (patch.stripe_customer_id) {
    const { error } = await service
      .from('users')
      .update(patch)
      .eq('stripe_customer_id', patch.stripe_customer_id);
    if (error) throw error;
  }
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
  origin: string;
}): Promise<{ url: string } | { error: string; status: number }> {
  const config = getStripeRuntimeConfig();
  if (!config.checkoutConfigured || !config.secretKey || !config.priceId) {
    return {
      status: 503,
      error: 'Stripe-betaling er ikke konfigurert ennå. Admin kan tildele Stemme+ for testing.',
    };
  }

  const stripe = new Stripe(config.secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: config.priceId, quantity: 1 }],
    success_url: `${args.origin}/dashboard/min-side?tab=stemme-plus&checkout=success`,
    cancel_url: `${args.origin}/dashboard/min-side?tab=stemme-plus&checkout=cancel`,
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
  origin: string;
}): Promise<{ url: string } | { error: string; status: number }> {
  const config = getStripeRuntimeConfig();
  if (!config.secretKey) {
    return { status: 503, error: 'Stripe-kundeportal er ikke konfigurert' };
  }
  const stripe = new Stripe(config.secretKey);
  const session = await stripe.billingPortal.sessions.create({
    customer: args.customerId,
    return_url: `${args.origin}/dashboard/min-side?tab=stemme-plus`,
  });
  return { url: session.url };
}
