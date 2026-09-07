import assert from 'node:assert/strict';
import {
  FIDER_OAUTH_CALLBACK_URL,
  FIDER_OAUTH_PROVIDER_SLUG_DEFAULT,
  FIDER_PRODUCTION_BASE_URL,
  getFiderOAuthCallbackUrl,
  getFiderOAuthProviderSlug,
  getFiderSsoStartUrl,
  isAllowedFiderRedirectUri,
} from './config';
import {
  issueAccessToken,
  issueAuthorizationCode,
  verifyAccessToken,
  verifyAuthorizationCode,
} from './oauth-tokens';

const secret = 'test-client-secret-for-fider-oauth';

const redirectUri = `https://forslag.example.com/oauth/${FIDER_OAUTH_PROVIDER_SLUG_DEFAULT}/callback`;

const code = issueAuthorizationCode('user-123', redirectUri, secret);
const verified = verifyAuthorizationCode(code, redirectUri, secret);
assert.ok(verified);
assert.equal(verified?.userId, 'user-123');

const wrongRedirect = verifyAuthorizationCode(code, 'https://evil.example/callback', secret);
assert.equal(wrongRedirect, null);

const accessToken = issueAccessToken('user-123', secret);
const access = verifyAccessToken(accessToken, secret);
assert.ok(access);
assert.equal(access?.userId, 'user-123');

delete process.env.FIDER_OAUTH_PROVIDER_SLUG;
assert.equal(getFiderOAuthProviderSlug(), FIDER_OAUTH_PROVIDER_SLUG_DEFAULT);

process.env.FIDER_BASE_URL = 'https://forslag.example.com';
assert.equal(
  getFiderOAuthCallbackUrl('https://forslag.example.com'),
  `https://forslag.example.com/oauth/${FIDER_OAUTH_PROVIDER_SLUG_DEFAULT}/callback`,
);
assert.equal(
  getFiderOAuthCallbackUrl(FIDER_PRODUCTION_BASE_URL),
  FIDER_OAUTH_CALLBACK_URL,
);
assert.equal(
  getFiderSsoStartUrl(FIDER_PRODUCTION_BASE_URL),
  `https://feedback.folkets-meninger.no/oauth/${FIDER_OAUTH_PROVIDER_SLUG_DEFAULT}`,
);
assert.ok(
  isAllowedFiderRedirectUri(
    `https://forslag.example.com/oauth/${FIDER_OAUTH_PROVIDER_SLUG_DEFAULT}/callback`,
    'https://forslag.example.com',
  ),
);
assert.equal(
  isAllowedFiderRedirectUri(
    `https://evil.example/oauth/${FIDER_OAUTH_PROVIDER_SLUG_DEFAULT}/callback`,
    'https://forslag.example.com',
  ),
  false,
);

process.env.FIDER_OAUTH_PROVIDER_SLUG = 'custom-provider';
assert.equal(getFiderOAuthProviderSlug(), 'custom-provider');
assert.equal(
  getFiderOAuthCallbackUrl('https://forslag.example.com'),
  'https://forslag.example.com/oauth/custom-provider/callback',
);
assert.ok(
  isAllowedFiderRedirectUri(
    'https://forslag.example.com/oauth/custom-provider/callback',
    'https://forslag.example.com',
  ),
);

delete process.env.FIDER_OAUTH_PROVIDER_SLUG;
delete process.env.FIDER_BASE_URL;

console.log('fider-oauth.test.ts: ok');
