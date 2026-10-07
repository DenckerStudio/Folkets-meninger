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

/** Canonical public site for Stripe Checkout/portal return URLs. */
export const STEMME_PLUS_DEFAULT_APP_BASE_URL = 'https://www.folkets-stemme.no';

/**
 * Prefer NEXT_PUBLIC_APP_URL when it is a valid http(s) URL; otherwise fall back
 * to www.folkets-stemme.no so Checkout never returns users to folkets-meninger.no.
 */
export function getStemmePlusAppBaseUrl(
  envValue: string | undefined = process.env.NEXT_PUBLIC_APP_URL,
): string {
  const raw = envValue?.trim();
  if (!raw) return STEMME_PLUS_DEFAULT_APP_BASE_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return STEMME_PLUS_DEFAULT_APP_BASE_URL;
    }
    return url.origin;
  } catch {
    return STEMME_PLUS_DEFAULT_APP_BASE_URL;
  }
}

