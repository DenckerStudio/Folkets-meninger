import type { User } from '@supabase/supabase-js';

/** Post-signup onboarding wizard and optional product tour for Folkets Meninger. */

export const ONBOARDING_PATH = '/auth/onboarding';

export const PRODUCT_TOUR_STORAGE_KEY = 'fm.product-tour.completed';
export const PRODUCT_TOUR_QUERY = 'tour';
export const PRODUCT_TOUR_EVENT = 'fm:start-product-tour';

export const ONBOARDING_META_KEYS = {
  pending: 'onboarding_pending',
  completed: 'onboarding_completed',
  skipped: 'onboarding_skipped',
  tourCompleted: 'onboarding_tour_completed',
} as const;

export type OnboardingStepId = 'welcome' | 'interests' | 'fylke';

export type OnboardingStep = {
  id: OnboardingStepId;
  index: number;
  label: string;
  title: string;
  description: string;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'welcome',
    index: 1,
    label: 'Velkommen',
    title: 'Velkommen til Folkets Meninger',
    description:
      'To korte steg – velg hjertesakene dine og fylket ditt. Du kan endre alt senere på Min side.',
  },
  {
    id: 'interests',
    index: 2,
    label: 'Hjertesaker',
    title: 'Hva bryr du deg om?',
    description:
      'Velg saksområdene du vil følge. Vi bruker dem til å varsle deg når nye saker treffer hjertesakene dine.',
  },
  {
    id: 'fylke',
    index: 3,
    label: 'Fylke',
    title: 'Hvor i landet er du?',
    description:
      'Fylket gir deg lokale tall i avstemninger. Det er valgfritt, og du kan la det stå tomt.',
  },
] as const;

/** Interest areas ("hjertesaker") offered in the wizard; mirrors the profile interest picker. */
export const INTEREST_AREAS = [
  'Helse og omsorg',
  'Energi og miljø',
  'Utdanning og forskning',
  'Transport',
  'Næring',
  'Justis',
] as const;

export type InterestArea = (typeof INTEREST_AREAS)[number];

export type OnboardingMetadata = {
  pending: boolean;
  completed: boolean;
  skipped: boolean;
  tourCompleted: boolean;
};

export function readOnboardingMetadata(
  user: Pick<User, 'user_metadata'> | null | undefined,
): OnboardingMetadata {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  return {
    pending: meta[ONBOARDING_META_KEYS.pending] === true,
    completed: meta[ONBOARDING_META_KEYS.completed] === true,
    skipped: meta[ONBOARDING_META_KEYS.skipped] === true,
    tourCompleted: meta[ONBOARDING_META_KEYS.tourCompleted] === true,
  };
}

export function buildOnboardingUserMetadata(
  patch: Partial<OnboardingMetadata>,
): Record<string, boolean> {
  const data: Record<string, boolean> = {};
  if (patch.pending !== undefined) data[ONBOARDING_META_KEYS.pending] = patch.pending;
  if (patch.completed !== undefined) data[ONBOARDING_META_KEYS.completed] = patch.completed;
  if (patch.skipped !== undefined) data[ONBOARDING_META_KEYS.skipped] = patch.skipped;
  if (patch.tourCompleted !== undefined) data[ONBOARDING_META_KEYS.tourCompleted] = patch.tourCompleted;
  return data;
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
      return 'interests';
    case 'interests':
      return 'fylke';
    case 'fylke':
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
    case 'interests':
      return 'welcome';
    case 'fylke':
      return 'interests';
    default: {
      const exhaustive: never = id;
      throw new Error(`Unknown onboarding step: ${exhaustive}`);
    }
  }
}

export function formatOnboardingStepIndex(index: number): string {
  return String(index).padStart(2, '0');
}

const NEW_AUTH_USER_MS = 24 * 60 * 60 * 1000;

/** True for accounts created in the last 24 hours — used to send new OAuth signups into onboarding. */
export function isNewAuthUser(createdAt: string | null | undefined, now = Date.now()): boolean {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  return now - created >= 0 && now - created < NEW_AUTH_USER_MS;
}

/** True when a just-authenticated user should be sent to the post-signup wizard. */
export function shouldStartSignupOnboarding(
  user:
    | (Pick<User, 'user_metadata'> & { created_at?: string | null })
    | null
    | undefined,
): boolean {
  if (!user) return false;
  const metadata = readOnboardingMetadata(user);
  if (metadata.completed || metadata.skipped) return false;
  if (metadata.pending) return true;
  return isNewAuthUser(user.created_at);
}

export function needsOnboarding(options: {
  metadata: OnboardingMetadata;
  hasPublicIdentity: boolean;
}): boolean {
  if (options.metadata.completed || options.metadata.skipped) return false;
  if (options.metadata.pending) return true;
  return !options.hasPublicIdentity;
}

export function stripProductTourQuery(path: string): string {
  const question = path.indexOf('?');
  if (question === -1) return path;
  const pathname = path.slice(0, question);
  const params = new URLSearchParams(path.slice(question + 1));
  params.delete(PRODUCT_TOUR_QUERY);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** After onboarding, land on Utforsk. Pass startTour after a fresh completion. */
export function postOnboardingDestination(
  nextPath: string,
  options?: { startTour?: boolean },
): string {
  const cleaned = stripProductTourQuery(nextPath);
  const dest =
    cleaned.startsWith('/dashboard') || cleaned.startsWith('/del')
      ? cleaned
      : '/dashboard/utforsk';
  if (!options?.startTour) return dest;
  const sep = dest.includes('?') ? '&' : '?';
  return `${dest}${sep}${PRODUCT_TOUR_QUERY}=1`;
}

export function onboardingPathWithNext(nextPath: string): string {
  return `${ONBOARDING_PATH}?next=${encodeURIComponent(nextPath)}`;
}

export function utforskWithTour(startTour = true): string {
  if (!startTour) return '/dashboard/utforsk';
  return `/dashboard/utforsk?${PRODUCT_TOUR_QUERY}=1`;
}

/* -------------------------------------------------------------------------- */
/* Optional product tour                                                      */
/* -------------------------------------------------------------------------- */

export type ProductTourStepId = 'utforsk' | 'reels' | 'varsler' | 'stemme';

export type ProductTourPlacement = 'right' | 'left' | 'bottom' | 'top';

export type ProductTourStep = {
  id: ProductTourStepId;
  title: string;
  body: string;
  selector: string;
  placement: ProductTourPlacement;
  /** Open the dashboard nav drawer before highlighting (mobile). */
  openNav: boolean;
};

export const PRODUCT_TOUR_STEPS: readonly ProductTourStep[] = [
  {
    id: 'utforsk',
    title: 'Utforsk saker',
    body: 'Her finner du lovforslag og representantforslag fra Stortinget. Åpne en sak for å lese, følge og stemme.',
    selector: '[data-tour="utforsk"]',
    placement: 'right',
    openNav: true,
  },
  {
    id: 'reels',
    title: 'Reels',
    body: 'Korte, systemgenererte ja/nei/blank-spørsmål bygget fra stortingssaker. Sveip og si din mening.',
    selector: '[data-tour="reels"]',
    placement: 'bottom',
    openNav: false,
  },
  {
    id: 'varsler',
    title: 'Varsler',
    body: 'Bjella samler varsler om hjertesakene og emnene dine, så du ikke går glipp av en sak som betyr noe for deg.',
    selector: '[data-tour="varsler"]',
    placement: 'bottom',
    openNav: false,
  },
  {
    id: 'stemme',
    title: 'Stemme+ chat',
    body: 'Den glødende knappen åpner Stemme+-chatten. Der kan du spørre om saker og få kilder – med din egen nøkkel.',
    selector: '[data-chat-orb]',
    placement: 'left',
    openNav: false,
  },
] as const;
