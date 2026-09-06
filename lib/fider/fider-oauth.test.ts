import assert from 'node:assert/strict';
import {
  getFiderOAuthCallbackUrl,
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

const redirectUri = 'https://forslag.example.com/oauth/folkets/callback';

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

process.env.FIDER_BASE_URL = 'https://forslag.example.com';
assert.equal(
  getFiderOAuthCallbackUrl('https://forslag.example.com'),
  'https://forslag.example.com/oauth/folkets/callback',
);
assert.equal(
  getFiderSsoStartUrl('https://forslag.example.com'),
  'https://forslag.example.com/oauth/folkets',
);
assert.ok(
  isAllowedFiderRedirectUri(
    'https://forslag.example.com/oauth/folkets/callback',
    'https://forslag.example.com',
  ),
);
assert.equal(
  isAllowedFiderRedirectUri('https://evil.example/oauth/folkets/callback', 'https://forslag.example.com'),
  false,
);

console.log('fider-oauth.test.ts: ok');
