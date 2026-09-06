import { NextResponse } from 'next/server';
import {
  getAppBaseUrl,
  getFiderBaseUrl,
  getFiderOAuthClientId,
  getFiderOAuthClientSecret,
  isAllowedFiderRedirectUri,
  isFiderConfigured,
} from '@/lib/fider/config';
import { issueAuthorizationCode } from '@/lib/fider/oauth-tokens';
import { getServerSupabase } from '@/lib/supabase-server';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

function oauthError(description: string, status = 400): NextResponse {
  return NextResponse.json({ error: 'invalid_request', error_description: description }, { status });
}

export async function GET(request: Request) {
  if (!isFiderConfigured()) {
    return NextResponse.json({ error: 'Fider OAuth is not configured' }, { status: 503 });
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const responseType = url.searchParams.get('response_type');
  const state = url.searchParams.get('state');

  if (clientId !== getFiderOAuthClientId()) {
    return oauthError('Ugyldig client_id');
  }
  if (responseType !== 'code') {
    return oauthError('Kun response_type=code støttes');
  }
  if (!redirectUri || !state) {
    return oauthError('Mangler redirect_uri eller state');
  }

  const fiderBaseUrl = getFiderBaseUrl();
  if (!fiderBaseUrl || !isAllowedFiderRedirectUri(redirectUri, fiderBaseUrl)) {
    return oauthError('Ugyldig redirect_uri');
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL(routes.login, getAppBaseUrl(url.origin));
    loginUrl.searchParams.set('next', `${url.pathname}${url.search}`);
    return NextResponse.redirect(loginUrl.toString());
  }

  const code = issueAuthorizationCode(user.id, redirectUri, getFiderOAuthClientSecret());
  const callback = new URL(redirectUri);
  callback.searchParams.set('code', code);
  callback.searchParams.set('state', state);

  return NextResponse.redirect(callback.toString());
}
