import { onboardingPathWithNext } from '@/lib/onboarding';
import { routes } from '@/lib/routes';
import { toRelativeNext } from '@/lib/safe-redirect';
import { getMetadataBase } from '@/lib/seo/metadata';

export const AUTH_CALLBACK_LOGIN_FAILED_PATH = '/auth/login?error=auth_failed';

/** Absolute URL on the public site origin (safe behind reverse proxies). */
export function absolutePublicRedirectUrl(relativePath: string): URL {
  return new URL(relativePath, getMetadataBase());
}

export function buildAuthCallbackFailureRedirect(): URL {
  return absolutePublicRedirectUrl(AUTH_CALLBACK_LOGIN_FAILED_PATH);
}

export function resolveAuthCallbackNext(nextParam: string | null): string {
  return toRelativeNext(nextParam);
}

export function buildAuthCallbackSuccessRedirect(next: string): URL {
  return absolutePublicRedirectUrl(next);
}

export function buildCompleteProfileRedirect(next: string): URL {
  const url = absolutePublicRedirectUrl(routes.completeProfile);
  url.searchParams.set('next', next);
  return url;
}

export function buildOnboardingRedirect(next: string): URL {
  return absolutePublicRedirectUrl(onboardingPathWithNext(next));
}
