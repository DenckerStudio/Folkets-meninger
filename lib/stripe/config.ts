export type StripeEnvConfig = {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
  stemmePlusPriceId: string;
};

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_WEBHOOK_SECRET?.trim() &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() &&
      process.env.STRIPE_STEMME_PLUS_PRICE_ID?.trim(),
  );
}

export function getStripeEnvConfig(): StripeEnvConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const stemmePlusPriceId = process.env.STRIPE_STEMME_PLUS_PRICE_ID?.trim();

  if (!secretKey || !webhookSecret || !publishableKey || !stemmePlusPriceId) {
    throw new Error(
      'Stripe is not configured (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_STEMME_PLUS_PRICE_ID)',
    );
  }

  return {
    secretKey,
    webhookSecret,
    publishableKey,
    stemmePlusPriceId,
  };
}
