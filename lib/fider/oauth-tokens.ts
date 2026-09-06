import { createHmac, timingSafeEqual } from 'crypto';

type OAuthTokenType = 'authorization_code' | 'access_token';

type OAuthTokenPayload = {
  typ: OAuthTokenType;
  sub: string;
  redirect_uri?: string;
  exp: number;
};

const AUTH_CODE_TTL_SECONDS = 5 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function createToken(
  payload: OAuthTokenPayload,
  secret: string,
): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

function verifyToken(
  token: string,
  expectedType: OAuthTokenType,
  secret: string,
): OAuthTokenPayload | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload, secret);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let payload: OAuthTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as OAuthTokenPayload;
  } catch {
    return null;
  }

  if (payload.typ !== expectedType) return null;
  if (!payload.sub || typeof payload.sub !== 'string') return null;
  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function issueAuthorizationCode(
  userId: string,
  redirectUri: string,
  secret: string,
): string {
  const exp = Math.floor(Date.now() / 1000) + AUTH_CODE_TTL_SECONDS;
  return createToken(
    { typ: 'authorization_code', sub: userId, redirect_uri: redirectUri, exp },
    secret,
  );
}

export function verifyAuthorizationCode(
  code: string,
  redirectUri: string,
  secret: string,
): { userId: string } | null {
  const payload = verifyToken(code, 'authorization_code', secret);
  if (!payload || payload.redirect_uri !== redirectUri) return null;
  return { userId: payload.sub };
}

export function issueAccessToken(userId: string, secret: string): string {
  const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  return createToken({ typ: 'access_token', sub: userId, exp }, secret);
}

export function verifyAccessToken(
  token: string,
  secret: string,
): { userId: string } | null {
  const payload = verifyToken(token, 'access_token', secret);
  if (!payload) return null;
  return { userId: payload.sub };
}

export const FIDER_ACCESS_TOKEN_EXPIRES_IN = ACCESS_TOKEN_TTL_SECONDS;
