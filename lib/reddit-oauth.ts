import { redditCommunityName } from '@/lib/reddit';

export const REDDIT_STATE_COOKIE = 'reddit_oauth_state';
export const REDDIT_INTENT_COOKIE = 'reddit_oauth_intent';
export const REDDIT_JOINED_COOKIE = 'reddit_joined';
export const REDDIT_JOINED_MAX_AGE = 60 * 60 * 24 * 365;

export function hasJoinedReddit(
  cookieValue: string | undefined,
  queryStatus?: string | string[] | null,
): boolean {
  const status = Array.isArray(queryStatus) ? queryStatus[0] : queryStatus;
  return cookieValue === '1' || status === 'joined';
}

export function redditNeedsJoin(joined: boolean): boolean {
  return isRedditOAuthConfigured() && !joined;
}

const AUTHORIZE_URL = 'https://www.reddit.com/api/v1/authorize';
const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const OAUTH_API = 'https://oauth.reddit.com';

export function isRedditOAuthConfigured(): boolean {
  return Boolean(process.env.REDDIT_CLIENT_ID?.trim() && process.env.REDDIT_CLIENT_SECRET?.trim());
}

export function redditRedirectUri(origin: string): string {
  const configured = process.env.REDDIT_REDIRECT_URI?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return `${origin.replace(/\/$/, '')}/api/reddit/callback`;
}

export function redditUserAgent(): string {
  const configured = process.env.REDDIT_USER_AGENT?.trim();
  if (configured) return configured;
  return `web:folkets-stemme:1.0.0 (by /u/${redditCommunityName()})`;
}

export function redditAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    response_type: 'code',
    state: input.state,
    redirect_uri: input.redirectUri,
    duration: 'temporary',
    scope: 'identity subscribe',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export function redditBasicAuthHeader(clientId: string, clientSecret: string): string {
  const token = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

export async function exchangeRedditCode(input: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: redditBasicAuthHeader(input.clientId, input.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': redditUserAgent(),
    },
    body,
    cache: 'no-store',
  });

  const json = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error || `Reddit token exchange failed (${res.status})`);
  }
  return json.access_token;
}

export async function subscribeRedditUser(accessToken: string, community = redditCommunityName()): Promise<void> {
  const body = new URLSearchParams({
    action: 'sub',
    sr_name: community,
    skip_initial_defaults: 'true',
    api_type: 'json',
  });

  const res = await fetch(`${OAUTH_API}/api/subscribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': redditUserAgent(),
    },
    body,
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Reddit subscribe failed (${res.status}) ${text.slice(0, 180)}`);
  }
}

export function encodeRedditIntentCookie(intent: unknown): string {
  return encodeURIComponent(JSON.stringify(intent));
}

export function decodeRedditIntentCookie(raw: string | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

export function isRedditIntent(value: unknown): value is {
  kind: 'join' | 'submit' | 'quote';
  title?: string;
  url?: string;
  quote?: string;
  sourceLabel?: string;
  next?: string;
} {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'join' || kind === 'submit' || kind === 'quote';
}
