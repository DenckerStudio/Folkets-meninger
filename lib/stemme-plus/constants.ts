/** Monthly price shown in UI and used when Stripe Price is configured (NOK). */
export const STEMME_PLUS_MONTHLY_PRICE_NOK = 59;

export const STEMME_PLUS_CURRENCY = 'nok';

export const SUBSCRIPTION_TIERS = ['free', 'stemme_plus'] as const;

export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'] as const;

export type SubscriptionStatus = string;

/** Shown wherever Stemme+ is sold — payment must not affect democracy features. */
export const STEMME_PLUS_NON_INFLUENCE_NOTE =
  'Betaling påvirker ikke stemmer, vekting, synlighet eller offentlig statistikk. Demokratiske funksjoner forblir gratis.';

export const STEMME_PLUS_BENEFITS = [
  'Støttemerke på profilen',
  'Lengre ukentlig oppsummering',
  'Varsler med en gang, også for sakene du følger',
  'Chat om sakene med din egen AI-nøkkel. Svarene bygger på saksdokumentene og viser kildene.',
] as const;
