import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  parseRedditIntentFromSearch,
  redditDestinationForIntent,
  absolutizeRedditIntent,
  type RedditIntent,
} from '@/lib/reddit';
import {
  isRedditOAuthConfigured,
  REDDIT_INTENT_COOKIE,
  REDDIT_JOINED_COOKIE,
  REDDIT_STATE_COOKIE,
  encodeRedditIntentCookie,
  redditAuthorizeUrl,
  redditRedirectUri,
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

function sanitizeIntent(intent: RedditIntent, origin: string): RedditIntent {
  const next = intent.next ? sanitizePostLoginPath(intent.next) : undefined;
  const url = intent.url?.trim();
  const allowedUrl =
    url && (url.startsWith(`${origin}/`) || url.startsWith('/')) ? url : undefined;
  return {
    ...intent,
    next,
    url: allowedUrl,
  };
}

function destinationForStart(origin: string, intent: RedditIntent): string {
  if (intent.kind === 'join') {
    const next = sanitizePostLoginPath(intent.next);
    return `${origin}${next}`;
  }
  return redditDestinationForIntent(intent);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const secure = origin.startsWith('https://');
  const intent = absolutizeRedditIntent(origin, sanitizeIntent(parseRedditIntentFromSearch(searchParams), origin));
  const destination = destinationForStart(origin, intent);

  const cookieStore = await cookies();
  const alreadyJoined = cookieStore.get(REDDIT_JOINED_COOKIE)?.value === '1';

  if (!isRedditOAuthConfigured() || alreadyJoined) {
    return NextResponse.redirect(destination);
  }

  const clientId = process.env.REDDIT_CLIENT_ID!.trim();
  const state = crypto.randomUUID();
  const authorizeUrl = redditAuthorizeUrl({
    clientId,
    redirectUri: redditRedirectUri(origin),
    state,
  });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(REDDIT_STATE_COOKIE, state, { ...cookieBase(secure), maxAge: 600 });
  response.cookies.set(REDDIT_INTENT_COOKIE, encodeRedditIntentCookie(intent), {
    ...cookieBase(secure),
    maxAge: 600,
  });
  return response;
}
