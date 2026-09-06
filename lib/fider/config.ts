/** Fider feature-request integration (OAuth SSO bridge). */

export const FIDER_OAUTH_PROVIDER_SLUG = 'folkets';

const trimTrailingSlash = (url: string) => url.replace(/\/$/, '');

export function getFiderBaseUrl(): string | null {
  const raw = process.env.FIDER_BASE_URL?.trim();
  if (!raw) return null;
  return trimTrailingSlash(raw);
}

export function isFiderConfigured(): boolean {
  return Boolean(
    getFiderBaseUrl() &&
      process.env.FIDER_OAUTH_CLIENT_ID?.trim() &&
      process.env.FIDER_OAUTH_CLIENT_SECRET?.trim(),
  );
}

export function getFiderOAuthClientId(): string {
  const id = process.env.FIDER_OAUTH_CLIENT_ID?.trim();
  if (!id) {
    throw new Error('FIDER_OAUTH_CLIENT_ID is not configured');
  }
  return id;
}

export function getFiderOAuthClientSecret(): string {
  const secret = process.env.FIDER_OAUTH_CLIENT_SECRET?.trim();
  if (!secret) {
    throw new Error('FIDER_OAUTH_CLIENT_SECRET is not configured');
  }
  return secret;
}

export function getAppBaseUrl(requestOrigin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  if (requestOrigin) return trimTrailingSlash(requestOrigin);
  return 'http://localhost:3000';
}

export function getFiderOAuthAuthorizeUrl(appBaseUrl: string): string {
  return `${trimTrailingSlash(appBaseUrl)}/api/oauth/fider/authorize`;
}

export function getFiderOAuthTokenUrl(appBaseUrl: string): string {
  return `${trimTrailingSlash(appBaseUrl)}/api/oauth/fider/token`;
}

export function getFiderOAuthUserinfoUrl(appBaseUrl: string): string {
  return `${trimTrailingSlash(appBaseUrl)}/api/oauth/fider/userinfo`;
}

export function getFiderOAuthCallbackUrl(fiderBaseUrl: string): string {
  const slug = process.env.FIDER_OAUTH_PROVIDER_SLUG?.trim() || FIDER_OAUTH_PROVIDER_SLUG;
  return `${trimTrailingSlash(fiderBaseUrl)}/oauth/${slug}/callback`;
}

/** URL that starts Fider sign-in via the Folkets Stemme OAuth provider. */
export function getFiderSsoStartUrl(fiderBaseUrl: string): string {
  const slug = process.env.FIDER_OAUTH_PROVIDER_SLUG?.trim() || FIDER_OAUTH_PROVIDER_SLUG;
  return `${trimTrailingSlash(fiderBaseUrl)}/oauth/${slug}`;
}

export function isAllowedFiderRedirectUri(redirectUri: string, fiderBaseUrl: string): boolean {
  try {
    const expected = getFiderOAuthCallbackUrl(fiderBaseUrl);
    const actual = new URL(redirectUri);
    const allowed = new URL(expected);
    return actual.origin === allowed.origin && actual.pathname === allowed.pathname;
  } catch {
    return false;
  }
}
