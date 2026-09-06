import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeEnvConfig, isStripeConfigured } from '@/lib/stripe/config';
import { getStripeClient } from '@/lib/stripe/client';
import {
  applyStemmePlusFromStripe,
  findUserIdByStripeCustomerId,
  revokeStemmePlusBySubscriptionId,
} from '@/lib/stemme-plus/service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const body = await request.text();
  const { webhookSecret } = getStripeEnvConfig();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature error', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error('Stripe webhook handler error', { type: event.type, error });
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id || session.client_reference_id;
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null;

  if (!userId || !customerId || !subscriptionId) {
    console.warn('checkout.session.completed missing ids', { userId, customerId, subscriptionId });
    return;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscriptionForUser(userId, customerId, subscription);
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? null;

  if (!customerId) return;

  const resolvedUserId = userId || (await findUserIdByStripeCustomerId(customerId));
  if (!resolvedUserId) {
    console.warn('subscription event without resolvable user', { subscriptionId: subscription.id });
    return;
  }

  if (subscription.status === 'canceled') {
    await revokeStemmePlusBySubscriptionId(subscription.id);
    return;
  }

  await syncSubscriptionForUser(resolvedUserId, customerId, subscription);
}

async function syncSubscriptionForUser(
  userId: string,
  customerId: string,
  subscription: Stripe.Subscription,
) {
  const periodEndSeconds = subscription.items.data[0]?.current_period_end ?? null;
  const periodEnd = periodEndSeconds ? new Date(periodEndSeconds * 1000) : null;

  await applyStemmePlusFromStripe({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    periodEnd,
  });
}
