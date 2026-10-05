import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripeRuntimeConfig } from '@/lib/stripe/config';
import {
  applyStripeSubscriptionToUser,
  clearStripeSubscription,
  getStripeClient,
  recordStripeEvent,
} from '@/lib/stripe/subscription';

export const dynamic = 'force-dynamic';

function userIdFrom(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const meta = (value as { metadata?: Record<string, unknown> }).metadata;
  const raw = meta?.user_id;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

export async function POST(request: Request) {
  const config = getStripeRuntimeConfig();
  const stripe = getStripeClient();
  if (!stripe || !config.webhookSecret) {
    return NextResponse.json({ error: 'Stripe-webhook er ikke konfigurert' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Mangler signatur' }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, config.webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Ugyldig Stripe-signatur' }, { status: 400 });
  }

  const first = await recordStripeEvent(event.id, event.type);
  if (!first) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription' || !session.subscription) break;
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await applyStripeSubscriptionToUser({
          userId: session.client_reference_id || userIdFrom(session) || userIdFrom(subscription),
          customerId: typeof session.customer === 'string' ? session.customer : null,
          subscription,
        });
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await applyStripeSubscriptionToUser({
          userId: userIdFrom(subscription),
          customerId: typeof subscription.customer === 'string' ? subscription.customer : null,
          subscription,
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string' ? subscription.customer : null;
        if (customerId) {
          await clearStripeSubscription(customerId);
        }
        break;
      }
      default:
        break;
    }
  } catch {
    console.error('[stripe-webhook] handler failed', event.type);
    return NextResponse.json({ error: 'Webhook-behandling feilet' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
