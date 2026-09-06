import Stripe from 'stripe';
import { getStripeEnvConfig } from '@/lib/stripe/config';

let cachedStripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cachedStripe) return cachedStripe;
  const { secretKey } = getStripeEnvConfig();
  cachedStripe = new Stripe(secretKey, {
    typescript: true,
  });
  return cachedStripe;
}
