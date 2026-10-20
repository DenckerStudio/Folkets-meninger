import assert from 'node:assert/strict';
import {
  ACCOUNT_LOCKOUT_MESSAGE_NB,
  LOGIN_CREDENTIALS_WRONG_MESSAGE_NB,
  PAYLOAD_EMAIL_PASSWORD_INCORRECT_EN,
  PAYLOAD_USER_LOCKED_EN,
} from './loginMessages';
import { localizeLoginResponse } from './localizeLoginResponse';

const successCookie = 'payload-token=abc123; Path=/; HttpOnly; Secure; SameSite=Lax';
const successSource = Response.json(
  {
    user: { id: 1, email: 'red@example.com' },
    token: 'jwt-token-value',
    exp: 123456,
  },
  {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': successCookie,
    },
  },
);

const success = await localizeLoginResponse(successSource);
assert.equal(success.status, 200);
assert.equal(success.headers.get('set-cookie'), successCookie);
const successBody = (await success.json()) as { user: { email: string }; token: string };
assert.equal(successBody.user.email, 'red@example.com');
assert.equal(successBody.token, 'jwt-token-value');

const wrongPassword = await localizeLoginResponse(
  Response.json(
    { errors: [{ message: PAYLOAD_EMAIL_PASSWORD_INCORRECT_EN }] },
    { status: 401 },
  ),
);
assert.equal(wrongPassword.status, 401);
const wrongBody = (await wrongPassword.json()) as { errors: { message: string }[] };
assert.equal(wrongBody.errors[0]?.message, LOGIN_CREDENTIALS_WRONG_MESSAGE_NB);

const locked = await localizeLoginResponse(
  Response.json(
    { errors: [{ message: PAYLOAD_USER_LOCKED_EN }] },
    { status: 401 },
  ),
);
const lockedBody = (await locked.json()) as { errors: { message: string }[] };
assert.equal(lockedBody.errors[0]?.message, ACCOUNT_LOCKOUT_MESSAGE_NB);

console.log('cms/src/lib/localizeLoginResponse.test.ts ok');
