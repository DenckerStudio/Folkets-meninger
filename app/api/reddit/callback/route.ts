import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  absolutizeRedditIntent,
  redditCommunityUrl,
  redditDestinationForIntent,
  type RedditIntent,
} from '@/lib/reddit';
import {
  decodeRedditIntentCookie,
  exchangeRedditCode,
  isRedditIntent,
  isRedditOAuthConfigured,
  REDDIT_INTENT_COOKIE,
  REDDIT_JOINED_COOKIE,
  REDDIT_JOINED_MAX_AGE,
  REDDIT_STATE_COOKIE,
  redditRedirectUri,
  subscribeRedditUser,
} from '@/lib/reddit-oauth';
import { sanitizePostLoginPath } from '@/lib/safe-redirect';

function cookieBase(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
  };
}

function fallbackDestination(origin: string, intent: RedditIntent | null): string {
  if (!intent) return redditCommunityUrl();
  if (intent.kind === 'join') {
    const next = sanitizePostLoginPath(intent.next);
    return `${origin}${next}${next.includes('?') ? '&' : '?'}reddit=joined`;
  }
  return redditDestinationForIntent(intent);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const secure = origin.startsWith('https://');
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(REDDIT_STATE_COOKIE)?.value;
  const rawIntent = decodeRedditIntentCookie(cookieStore.get(REDDIT_INTENT_COOKIE)?.value);
  const intent = isRedditIntent(rawIntent) ? absolutizeRedditIntent(origin, rawIntent) : null;
  const error = searchParams.get('error');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const clearOauth = (response: NextResponse) => {
    response.cookies.set(REDDIT_STATE_COOKIE, '', { ...cookieBase(secure), maxAge: 0 });
    response.cookies.set(REDDIT_INTENT_COOKIE, '', { ...cookieBase(secure), maxAge: 0 });
    return response;
  };

  if (error || !code || !expectedState || state !== expectedState) {
    const dest = intent?.next
      ? `${origin}${sanitizePostLoginPath(intent.next)}${sanitizePostLoginPath(intent.next).includes('?') ? '&' : '?'}reddit=denied`
      : redditCommunityUrl();
    return clearOauth(NextResponse.redirect(dest));
  }

  if (!isRedditOAuthConfigured()) {
    return clearOauth(NextResponse.redirect(fallbackDestination(origin, intent)));
  }

  try {
    const accessToken = await exchangeRedditCode({
      code,
      redirectUri: redditRedirectUri(origin),
      clientId: process.env.REDDIT_CLIENT_ID!.trim(),
      clientSecret: process.env.REDDIT_CLIENT_SECRET!.trim(),
    });
    await subscribeRedditUser(accessToken);
  } catch (subscribeError) {
    console.error('Reddit join failed', subscribeError);
    const dest = intent?.next
      ? `${origin}${sanitizePostLoginPath(intent.next)}${sanitizePostLoginPath(intent.next).includes('?') ? '&' : '?'}reddit=error`
      : redditCommunityUrl();
    return clearOauth(NextResponse.redirect(dest));
  }

  const destination = fallbackDestination(origin, intent);
  const response = NextResponse.redirect(destination);
  response.cookies.set(REDDIT_JOINED_COOKIE, '1', { ...cookieBase(secure), maxAge: REDDIT_JOINED_MAX_AGE });
  return clearOauth(response);
}
