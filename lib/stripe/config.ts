/**
 * Stripe is the production payment path (Vercel Marketplace → Stripe).
 * Checkout stays disabled until secret key + Stemme+ Price id exist.
 */
export type StripeRuntimeConfig = {
  checkoutConfigured: boolean;
  webhookConfigured: boolean;
  secretKey: string | null;
  webhookSecret: string | null;
  priceId: string | null;
  publishableKey: string | null;
};

export function getStripeRuntimeConfig(): StripeRuntimeConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() || null;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
  const priceId = process.env.STRIPE_STEMME_PLUS_PRICE_ID?.trim() || null;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null;

  return {
    checkoutConfigured: Boolean(secretKey && priceId),
    webhookConfigured: Boolean(secretKey && webhookSecret),
    secretKey,
    webhookSecret,
    priceId,
    publishableKey,
  };
}

export function isStripeCheckoutConfigured(): boolean {
  return getStripeRuntimeConfig().checkoutConfigured;
}
