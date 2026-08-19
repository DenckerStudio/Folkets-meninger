import type { User } from '@supabase/supabase-js';

export const ONBOARDING_PATH = '/auth/onboarding';

export const PRODUCT_TOUR_STORAGE_KEY = 'fs.product-tour.completed';
export const PRODUCT_TOUR_QUERY = 'tour';
export const PRODUCT_TOUR_EVENT = 'fs:start-product-tour';

export const ONBOARDING_META_KEYS = {
  pending: 'onboarding_pending',
  completed: 'onboarding_completed',
  skipped: 'onboarding_skipped',
  tourCompleted: 'onboarding_tour_completed',
  bankIdVerified: 'onboarding_bankid_verified',
} as const;

export type OnboardingStepId = 'welcome' | 'name' | 'sms' | 'bankid';

export type OnboardingStep = {
  id: OnboardingStepId;
  index: number;
  label: string;
  title: string;
  description: string;
  optional: boolean;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'welcome',
    index: 1,
    label: 'Velkommen',
    title: 'Velkommen til Folkets Stemme',
    description: 'Tre steg er obligatoriske: navn, SMS og BankID. Etterpå kan du ta en kort omvisning — den kan hoppes over.',
    optional: false,
  },
  {
    id: 'name',
    index: 2,
    label: 'Navn',
    title: 'Hvem er du?',
    description: 'Fornavn og etternavn vises på offentlige innspill, for eksempel høringer. Stemmer forblir anonyme i statistikken.',
    optional: false,
  },
  {
    id: 'sms',
    index: 3,
    label: 'SMS',
    title: 'Bekreft med SMS',
    description: 'Én person, én stemme. Du må bekrefte telefonnummeret med koden vi sender.',
    optional: false,
  },
  {
    id: 'bankid',
    index: 4,
    label: 'BankID',
    title: 'Bekreft med BankID',
    description: 'BankID er påkrevd for å sikre identiteten din før du deltar.',
    optional: false,
  },
] as const;

export type ProductTourStepId = 'utforsk' | 'horinger' | 'min-side' | 'varsler';

export type ProductTourPlacement = 'right' | 'left' | 'bottom' | 'top';

export type ProductTourStep = {
  id: ProductTourStepId;
  title: string;
  body: string;
  selector: string;
  placement: ProductTourPlacement;
  openNav: boolean;
};

export const PRODUCT_TOUR_STEPS: readonly ProductTourStep[] = [
  {
    id: 'utforsk',
    title: 'Utforsk saker',
    body: 'Her ligger Stortingets saker. Åpne en sak for å lese, følge med og stemme i «Hva mener du?».',
    selector: '[data-tour="utforsk"]',
    placement: 'right',
    openNav: true,
  },
  {
    id: 'horinger',
    title: 'Høringer',
    body: 'Gi innspill til pågående høringer. Offentlige kommentarer krever fornavn og etternavn.',
    selector: '[data-tour="horinger"]',
    placement: 'right',
    openNav: true,
  },
  {
    id: 'min-side',
    title: 'Min side',
    body: 'Stemmehistorikk, profil og innstillinger. Omvisningen kan du starte på nytt herfra.',
    selector: '[data-tour="min-side"]',
    placement: 'right',
    openNav: true,
  },
  {
    id: 'varsler',
    title: 'Varsler',
    body: 'Klokken øverst til høyre samler varsler om saker og høringer du følger.',
    selector: '[data-tour="varsler"]',
    placement: 'bottom',
    openNav: false,
  },
] as const;

export type OnboardingMetadata = {
  pending: boolean;
  completed: boolean;
  skipped: boolean;
  tourCompleted: boolean;
  bankIdVerified: boolean;
};

export type OnboardingProgressGate = {
  hasName: boolean;
  phoneVerified: boolean;
  bankIdVerified: boolean;
};

function readBooleanMeta(meta: Record<string, unknown>, key: string): boolean {
  return meta[key] === true;
}

export function readOnboardingMetadata(user: Pick<User, 'user_metadata'> | null | undefined): OnboardingMetadata {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  return {
    pending: readBooleanMeta(meta, ONBOARDING_META_KEYS.pending),
    completed: readBooleanMeta(meta, ONBOARDING_META_KEYS.completed),
    skipped: readBooleanMeta(meta, ONBOARDING_META_KEYS.skipped),
    tourCompleted: readBooleanMeta(meta, ONBOARDING_META_KEYS.tourCompleted),
    bankIdVerified: readBooleanMeta(meta, ONBOARDING_META_KEYS.bankIdVerified),
  };
}

export function buildOnboardingUserMetadata(patch: Partial<OnboardingMetadata>): Record<string, boolean> {
  const data: Record<string, boolean> = {};
  if (patch.pending !== undefined) data[ONBOARDING_META_KEYS.pending] = patch.pending;
  if (patch.completed !== undefined) data[ONBOARDING_META_KEYS.completed] = patch.completed;
  if (patch.skipped !== undefined) data[ONBOARDING_META_KEYS.skipped] = patch.skipped;
  if (patch.tourCompleted !== undefined) data[ONBOARDING_META_KEYS.tourCompleted] = patch.tourCompleted;
  if (patch.bankIdVerified !== undefined) data[ONBOARDING_META_KEYS.bankIdVerified] = patch.bankIdVerified;
  return data;
}

export function canAdvanceOnboardingStep(step: OnboardingStepId, gate: OnboardingProgressGate): boolean {
  switch (step) {
    case 'welcome':
      return true;
    case 'name':
      return gate.hasName;
    case 'sms':
      return gate.phoneVerified;
    case 'bankid':
      return gate.bankIdVerified;
    default: {
      const exhaustive: never = step;
      throw new Error(`Unknown onboarding step: ${exhaustive}`);
    }
  }
}

export function needsOnboarding(options: {
  metadata: OnboardingMetadata;
  hasPublicIdentity: boolean;
}): boolean {
  if (options.metadata.completed || options.metadata.skipped) return false;
  if (options.metadata.pending) return true;
  return !options.hasPublicIdentity;
}

export function getOnboardingStep(id: OnboardingStepId): OnboardingStep {
  const step = ONBOARDING_STEPS.find((item) => item.id === id);
  if (!step) {
    throw new Error(`Unknown onboarding step: ${id}`);
  }
  return step;
}

export function nextOnboardingStepId(id: OnboardingStepId): OnboardingStepId | null {
  switch (id) {
    case 'welcome':
      return 'name';
    case 'name':
      return 'sms';
    case 'sms':
      return 'bankid';
    case 'bankid':
      return null;
    default: {
      const exhaustive: never = id;
      throw new Error(`Unknown onboarding step: ${exhaustive}`);
    }
  }
}

export function previousOnboardingStepId(id: OnboardingStepId): OnboardingStepId | null {
  switch (id) {
    case 'welcome':
      return null;
    case 'name':
      return 'welcome';
    case 'sms':
      return 'name';
    case 'bankid':
      return 'sms';
    default: {
      const exhaustive: never = id;
      throw new Error(`Unknown onboarding step: ${exhaustive}`);
    }
  }
}

/** Normalize a Norwegian phone number to E.164. Returns null if invalid. */
export function normalizePhoneNumber(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return null;

  let e164Digits = digits;
  if (plus) {
    e164Digits = digits;
  } else if (digits.startsWith('00') && digits.length > 8) {
    e164Digits = digits.slice(2);
  } else if (digits.startsWith('47') && digits.length >= 10) {
    e164Digits = digits;
  } else if (digits.length === 8) {
    e164Digits = `47${digits}`;
  } else {
    return null;
  }

  if (e164Digits.length < 8 || e164Digits.length > 15) return null;
  if (e164Digits.startsWith('47') && e164Digits.length !== 10) return null;
  return `+${e164Digits}`;
}

export function formatOnboardingStepIndex(index: number): string {
  return String(index).padStart(2, '0');
}

export function onboardingPathWithNext(nextPath: string): string {
  return `${ONBOARDING_PATH}?next=${encodeURIComponent(nextPath)}`;
}

export function utforskWithTour(startTour = true): string {
  if (!startTour) return '/dashboard/utforsk';
  return `/dashboard/utforsk?${PRODUCT_TOUR_QUERY}=1`;
}
