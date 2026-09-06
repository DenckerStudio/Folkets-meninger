import { NextResponse } from 'next/server';
import {
  ensureFiderOAuthConfigured,
  parseOAuthFormBody,
  validateOAuthClientCredentials,
} from '@/lib/fider/oauth-http';
import { getFiderBaseUrl, isAllowedFiderRedirectUri } from '@/lib/fider/config';
import {
  FIDER_ACCESS_TOKEN_EXPIRES_IN,
  issueAccessToken,
  verifyAuthorizationCode,
} from '@/lib/fider/oauth-tokens';
import { getFiderOAuthClientSecret } from '@/lib/fider/config';

export const dynamic = 'force-dynamic';

function oauthError(description: string, status = 400): NextResponse {
  return NextResponse.json({ error: 'invalid_grant', error_description: description }, { status });
}

export async function POST(request: Request) {
  const notConfigured = ensureFiderOAuthConfigured();
  if (notConfigured) return notConfigured;

  const body = await parseOAuthFormBody(request);
  const grantType = body.grant_type;
  const code = body.code;
  const redirectUri = body.redirect_uri;
  const clientId = body.client_id;
  const clientSecret = body.client_secret;

  if (grantType !== 'authorization_code') {
    return oauthError('Kun grant_type=authorization_code støttes');
  }
  if (!code || !redirectUri) {
    return oauthError('Mangler code eller redirect_uri');
  }
  if (!validateOAuthClientCredentials(clientId, clientSecret)) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
  }

  const fiderBaseUrl = getFiderBaseUrl();
  if (!fiderBaseUrl || !isAllowedFiderRedirectUri(redirectUri, fiderBaseUrl)) {
    return oauthError('Ugyldig redirect_uri');
  }

  const verified = verifyAuthorizationCode(code, redirectUri, getFiderOAuthClientSecret());
  if (!verified) {
    return oauthError('Ugyldig eller utløpt code');
  }

  const accessToken = issueAccessToken(verified.userId, getFiderOAuthClientSecret());
  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: FIDER_ACCESS_TOKEN_EXPIRES_IN,
  });
}
