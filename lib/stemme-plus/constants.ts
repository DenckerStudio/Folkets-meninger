/** Monthly price shown in UI and used when Stripe Price is configured (NOK). */
export const STEMME_PLUS_MONTHLY_PRICE_NOK = 59;

export const STEMME_PLUS_CURRENCY = 'nok';

export const SUBSCRIPTION_TIERS = ['free', 'stemme_plus'] as const;

export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'] as const;

export type SubscriptionStatus = string;

export const STEMME_PLUS_BENEFITS = [
  'Støttemerke på profilen',
  'Rikere ukentlig nyhetsoppsummering',
  'Sanntidsvarsler og smartere hjertesak-varsler',
  'AI-chat om saker med din egen LLM-nøkkel (BYOK), RAG og kildesøk',
] as const;
